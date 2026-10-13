
import Link from "../models/link.model.js";
import Click from "../models/click.model.js";
import crypto from "crypto";

const createLink = async (req, res) => {
  try {
    const { originalUrl } = req.body;

    // Check whether the URL was provided
    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: "Original URL is required",
      });
    }

    // Generate a unique short code
    const shortCode = crypto.randomBytes(4).toString("hex");//Generates random bytes for a short code

    // Save the link in MongoDB
    const link = await Link.create({
      originalUrl,
      shortCode,
      user: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Short link created successfully",
      data: link,
    });
  } catch (error) {
    console.error("Create link error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create short link",
    });
  }
};
//means the code is count  the update for the link how mony user are clivk thri link
const redirectLink = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOneAndUpdate(//start the coutn by one 
      { shortCode },//find the link in mongoDB
      { $inc: { clicks: 1 } },//increases the click count by one.
      { new: true }//returns the updated document.
    );

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Short link not found",
      });
    }
   
    // Save this individual click with its timestamp
    await Click.create({
      link: link._id,
    });

    // Increase the total click count
    link.clicks += 1;
    await link.save();

    return res.redirect(link.originalUrl);
  } catch (error) {
    console.error("Redirect link error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to redirect",
    });
  }
};
//it count the date and time and also history
const getClickHistory = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({
      shortCode,
      user: req.user.userId,
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found",
      });
    }

    const clicks = await Click.find({
      link: link._id,
    }).sort({ clickedAt: -1 });

    const history = clicks.map((click) => ({
      clickedAt: click.clickedAt,
      clickedAtIST: click.clickedAt.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
    }));

    return res.status(200).json({
      success: true,
      shortCode: link.shortCode,
      totalClicks: link.clicks,
      history,
    });
  } catch (error) {
    console.error("Click history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch click history",
    });
  }
};

const getMyLinks = async (req, res) => {
  try {
    const links = await Link.find({
      user: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      totalLinks: links.length,
      totalClicks: links.reduce(
        (total, link) => total + link.clicks,
        0
      ),
      data: links,
    });
  } catch (error) {
    console.error("Get my links error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch links",
    });
  }
};


export { createLink, redirectLink,getClickHistory,getMyLinks};
