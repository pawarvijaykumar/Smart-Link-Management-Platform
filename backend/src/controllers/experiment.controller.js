// =============================================================================
// CHANGE: Stage 13 Smart A/B Link Testing Controller — 2026-11-17
// Complete lifecycle management, statistical traffic allocation,
// fallback routing, and IST analytics for A/B split testing experiments.
// =============================================================================

import crypto from "crypto";
import mongoose from "mongoose";
import Experiment from "../models/experiment.model.js";
import Link from "../models/link.model.js";
import Click from "../models/click.model.js";
import Notification from "../models/notification.model.js";
import {
  isValidHttpUrl,
  getISTCalendarStart,
  getISTDateStr,
  generateISTDateList,
  getDaysDiff,
} from "./link.controller.js";

// -----------------------------------------------------------------------------
// 1. Create a new A/B Experiment & associated Short Link
// -----------------------------------------------------------------------------
const createExperiment = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized request" });
    }

    const { name, variantA, variantB, status, fallbackVariant } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Experiment name is required",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Experiment name cannot exceed 100 characters",
      });
    }

    if (!variantA || !isValidHttpUrl(variantA)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid HTTP or HTTPS URL for Variant A (e.g. https://example.com/landing-a)",
      });
    }

    if (!variantB || !isValidHttpUrl(variantB)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid HTTP or HTTPS URL for Variant B (e.g. https://example.com/landing-b)",
      });
    }

    const initialStatus = status === "active" ? "active" : "draft";
    const initialFallback = fallbackVariant === "B" ? "B" : "A";
    const userOid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    // Generate unique short code for the public experiment short link
    const shortCode = crypto.randomBytes(4).toString("hex");

    // Create the associated Link document
    const link = await Link.create({
      originalUrl: variantA.trim(),
      shortCode,
      user: userOid,
      isExperiment: true,
    });

    // Create the Experiment document
    const experiment = await Experiment.create({
      user: userOid,
      link: link._id,
      name: name.trim(),
      variantA: variantA.trim(),
      variantB: variantB.trim(),
      trafficSplit: { a: 50, b: 50 },
      status: initialStatus,
      fallbackVariant: initialFallback,
      startedAt: initialStatus === "active" ? new Date() : null,
      completedAt: null,
    });

    // Associate experiment reference on Link document
    link.experiment = experiment._id;
    await link.save();

    // Create in-app notification
    try {
      await Notification.create({
        user: userOid,
        type: "experiment",
        title: "A/B Experiment Created",
        message: `Experiment "${experiment.name}" (s/${shortCode}) was created successfully.`,
        linkId: link._id,
        idempotencyKey: `exp_created_${experiment._id}`,
      });
    } catch (notifErr) {
      if (notifErr.code !== 11000) {
        console.error("Non-blocking experiment notification error:", notifErr);
      }
    }

    return res.status(201).json({
      success: true,
      message: "A/B Experiment created successfully",
      experiment: {
        ...experiment.toObject(),
        shortCode,
      },
      link,
    });
  } catch (error) {
    console.error("Create experiment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create A/B experiment",
    });
  }
};

// -----------------------------------------------------------------------------
// 2. List all experiments owned by the authenticated user
// -----------------------------------------------------------------------------
const getExperiments = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized request" });
    }

    const userOid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const experiments = await Experiment.find({ user: userOid })
      .populate("link", "shortCode clicks isPaused expiresAt maxClicks createdAt")
      .sort({ createdAt: -1 })
      .lean();

    if (experiments.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        experiments: [],
      });
    }

    const experimentIds = experiments.map((e) => e._id);

    // Aggregate lifetime recorded clicks for each experiment variant
    const clickAggregation = await Click.aggregate([
      { $match: { experimentId: { $in: experimentIds } } },
      {
        $group: {
          _id: { experimentId: "$experimentId", variant: "$experimentVariant" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build click map: experimentId -> { A: count, B: count }
    const clickMap = new Map();
    clickAggregation.forEach((item) => {
      const expId = item._id?.experimentId?.toString();
      const variant = item._id?.variant;
      if (!expId || !variant) return;
      if (!clickMap.has(expId)) clickMap.set(expId, { A: 0, B: 0 });
      clickMap.get(expId)[variant] = item.count;
    });

    const enrichedExperiments = experiments.map((exp) => {
      const expIdStr = exp._id.toString();
      const stats = clickMap.get(expIdStr) || { A: 0, B: 0 };
      const variantAClicks = stats.A || 0;
      const variantBClicks = stats.B || 0;
      const totalClicks = variantAClicks + variantBClicks;

      let winningVariant = "NONE";
      if (variantAClicks > variantBClicks) winningVariant = "A";
      else if (variantBClicks > variantAClicks) winningVariant = "B";
      else if (totalClicks > 0 && variantAClicks === variantBClicks) winningVariant = "TIE";

      return {
        ...exp,
        shortCode: exp.link?.shortCode || "",
        totalClicks,
        variantAClicks,
        variantBClicks,
        winningVariant,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedExperiments.length,
      experiments: enrichedExperiments,
    });
  } catch (error) {
    console.error("Get experiments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch A/B experiments",
    });
  }
};

// -----------------------------------------------------------------------------
// 3. Get single experiment by ID
// -----------------------------------------------------------------------------
const getExperimentById = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized request" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid experiment ID format" });
    }

    const userOid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const experiment = await Experiment.findOne({ _id: id, user: userOid })
      .populate("link", "shortCode clicks isPaused expiresAt maxClicks createdAt")
      .lean();

    if (!experiment) {
      return res.status(404).json({
        success: false,
        message: "A/B Experiment not found",
      });
    }

    return res.status(200).json({
      success: true,
      experiment: {
        ...experiment,
        shortCode: experiment.link?.shortCode || "",
      },
    });
  } catch (error) {
    console.error("Get experiment by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch experiment details",
    });
  }
};

// -----------------------------------------------------------------------------
// 4. Update experiment configuration (while allowed)
// -----------------------------------------------------------------------------
const updateExperiment = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized request" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid experiment ID format" });
    }

    const userOid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const experiment = await Experiment.findOne({ _id: id, user: userOid });
    if (!experiment) {
      return res.status(404).json({ success: false, message: "A/B Experiment not found" });
    }

    if (experiment.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed experiments cannot be edited",
      });
    }

    const { name, variantA, variantB, fallbackVariant } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ success: false, message: "Experiment name cannot be empty" });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ success: false, message: "Experiment name cannot exceed 100 characters" });
      }
      experiment.name = name.trim();
    }

    if (variantA !== undefined) {
      if (!isValidHttpUrl(variantA)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid HTTP or HTTPS URL for Variant A",
        });
      }
      experiment.variantA = variantA.trim();
      // Keep underlying Link originalUrl aligned with Variant A
      await Link.updateOne({ _id: experiment.link }, { originalUrl: variantA.trim() });
    }

    if (variantB !== undefined) {
      if (!isValidHttpUrl(variantB)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid HTTP or HTTPS URL for Variant B",
        });
      }
      experiment.variantB = variantB.trim();
    }

    if (fallbackVariant !== undefined) {
      if (!["A", "B"].includes(fallbackVariant)) {
        return res.status(400).json({
          success: false,
          message: "Fallback variant must be either 'A' or 'B'",
        });
      }
      experiment.fallbackVariant = fallbackVariant;
    }

    await experiment.save();

    return res.status(200).json({
      success: true,
      message: "Experiment updated successfully",
      experiment,
    });
  } catch (error) {
    console.error("Update experiment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update experiment",
    });
  }
};

// -----------------------------------------------------------------------------
// 5. Update experiment lifecycle status (start, pause, complete, set fallback)
// -----------------------------------------------------------------------------
const updateExperimentStatus = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized request" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid experiment ID format" });
    }

    const userOid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const experiment = await Experiment.findOne({ _id: id, user: userOid });
    if (!experiment) {
      return res.status(404).json({ success: false, message: "A/B Experiment not found" });
    }

    const { status, fallbackVariant } = req.body;

    if (!status || !["draft", "active", "paused", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed values: draft, active, paused, completed",
      });
    }

    if (fallbackVariant !== undefined) {
      if (!["A", "B"].includes(fallbackVariant)) {
        return res.status(400).json({
          success: false,
          message: "Fallback variant must be either 'A' or 'B'",
        });
      }
      experiment.fallbackVariant = fallbackVariant;
    }

    // Lifecycle transitions
    if (status === "active" && !experiment.startedAt) {
      experiment.startedAt = new Date();
    } else if (status === "completed") {
      experiment.completedAt = new Date();
    }

    experiment.status = status;
    await experiment.save();

    return res.status(200).json({
      success: true,
      message: `Experiment status updated to ${status}`,
      experiment,
    });
  } catch (error) {
    console.error("Update experiment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update experiment status",
    });
  }
};

// -----------------------------------------------------------------------------
// 6. Get Experiment Analytics (clicks, split %, daily IST trend, winner)
// -----------------------------------------------------------------------------
const getExperimentAnalytics = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized request" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid experiment ID format" });
    }

    const userOid = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const experiment = await Experiment.findOne({ _id: id, user: userOid })
      .populate("link", "shortCode clicks isPaused expiresAt maxClicks createdAt")
      .lean();

    if (!experiment) {
      return res.status(404).json({ success: false, message: "A/B Experiment not found" });
    }

    const rawRange = (req.query.range || "7d").toString().toLowerCase().trim();
    const range = rawRange === "30d" || rawRange === "all" ? rawRange : "7d";
    let daysCount = range === "30d" ? 30 : 7;

    const todayStr = getISTDateStr();

    if (range === "all") {
      let earliestDate = todayStr;
      if (experiment.createdAt) {
        const cDate = getISTDateStr(new Date(experiment.createdAt));
        if (cDate < earliestDate) earliestDate = cDate;
      }
      const span = getDaysDiff(earliestDate, todayStr);
      daysCount = Math.max(7, Math.min(span, 90));
    }

    const dates = generateISTDateList(daysCount, todayStr);

    // Build Click match filter
    const matchCondition = {
      experimentId: experiment._id,
    };
    if (range === "7d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(7) };
    } else if (range === "30d") {
      matchCondition.clickedAt = { $gte: getISTCalendarStart(30) };
    }

    const [aggResult] = await Click.aggregate([
      { $match: matchCondition },
      {
        $facet: {
          // Overall counts per variant
          variantTotals: [
            {
              $group: {
                _id: "$experimentVariant",
                clicks: { $sum: 1 },
              },
            },
          ],
          // Daily clicks per variant in IST
          dailySeries: [
            {
              $group: {
                _id: {
                  date: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: "$clickedAt",
                      timezone: "+05:30",
                    },
                  },
                  variant: "$experimentVariant",
                },
                clicks: { $sum: 1 },
              },
            },
            { $sort: { "_id.date": 1 } },
          ],
        },
      },
    ]);

    // Parse variant totals
    let variantAClicks = 0;
    let variantBClicks = 0;

    (aggResult?.variantTotals || []).forEach((item) => {
      if (item._id === "A") variantAClicks = item.clicks;
      if (item._id === "B") variantBClicks = item.clicks;
    });

    const totalClicks = variantAClicks + variantBClicks;

    const variantAPercentage =
      totalClicks > 0 ? Math.round((variantAClicks / totalClicks) * 100) : 50;
    const variantBPercentage =
      totalClicks > 0 ? 100 - variantAPercentage : 50;

    // Determine winning variant strictly by total recorded clicks
    let winningVariant = "NONE";
    let winningReason = "No clicks recorded yet in the selected period.";

    if (variantAClicks > variantBClicks) {
      winningVariant = "A";
      winningReason = `Variant A is leading with more recorded clicks (${variantAClicks.toLocaleString()} vs ${variantBClicks.toLocaleString()} clicks).`;
    } else if (variantBClicks > variantAClicks) {
      winningVariant = "B";
      winningReason = `Variant B is leading with more recorded clicks (${variantBClicks.toLocaleString()} vs ${variantAClicks.toLocaleString()} clicks).`;
    } else if (totalClicks > 0 && variantAClicks === variantBClicks) {
      winningVariant = "TIE";
      winningReason = `Both variants have recorded equal clicks (${variantAClicks.toLocaleString()} clicks each).`;
    }

    // Build continuous zero-filled daily timeline
    const dailyMapA = new Map();
    const dailyMapB = new Map();

    (aggResult?.dailySeries || []).forEach((item) => {
      const d = item._id?.date;
      const v = item._id?.variant;
      if (!d) return;
      if (v === "A") dailyMapA.set(d, item.clicks);
      if (v === "B") dailyMapB.set(d, item.clicks);
    });

    const timeline = dates.map((d) => {
      const a = dailyMapA.get(d) || 0;
      const b = dailyMapB.get(d) || 0;
      return {
        date: d,
        variantA: a,
        variantB: b,
        total: a + b,
      };
    });

    return res.status(200).json({
      success: true,
      range,
      experiment: {
        _id: experiment._id,
        name: experiment.name,
        status: experiment.status,
        variantA: experiment.variantA,
        variantB: experiment.variantB,
        fallbackVariant: experiment.fallbackVariant,
        shortCode: experiment.link?.shortCode || "",
        trafficSplit: experiment.trafficSplit || { a: 50, b: 50 },
        startedAt: experiment.startedAt,
        completedAt: experiment.completedAt,
        createdAt: experiment.createdAt,
      },
      summary: {
        totalClicks,
        variantAClicks,
        variantBClicks,
        variantAPercentage,
        variantBPercentage,
        winningVariant,
        winningReason,
        disclaimer:
          "The winner is determined strictly by total recorded clicks. Conversion rate tracking is not enabled in this version.",
      },
      timeline,
    });
  } catch (error) {
    console.error("Get experiment analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch experiment analytics",
    });
  }
};

export {
  createExperiment,
  getExperiments,
  getExperimentById,
  updateExperiment,
  updateExperimentStatus,
  getExperimentAnalytics,
};
