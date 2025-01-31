import express from 'express';
import authRouter from './routes/auth.js';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Message from './models/Messages.js'; // Import your Message model
import Tag from './models/Tags.js'; // Import your Tag model
import User from './models/User.js'; // Import User model
import multer from "multer"; // Import Multer
import path from "path"; // For handling file paths
import fs from "fs";

const app = express();
dotenv.config();
const PORT = process.env.PORT || 5000;

const corsOptions = {
    origin: 'http://localhost:3000',
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/auth', authRouter);

mongoose
    .connect('mongodb://localhost:27017/rigel', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.log('MongoDB connection error:', err));

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(500).json({ message: 'No token found' });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

async function handleTags(tags) {
    try {
        const tagPromises = tags.map(async (tag) => {
            const normalizedTag = tag.trim().toLowerCase(); // Normalize tag
            const existingTag = await Tag.findOne({ name: normalizedTag });
            if (existingTag) {
                // Increment frequency if tag exists
                existingTag.frequency += 1;
                existingTag.lastUsed = new Date();
                await existingTag.save();
            } else {
                // Create a new tag
                const newTag = new Tag({ name: normalizedTag, frequency: 1 });
                await newTag.save();
            }
        });

        await Promise.all(tagPromises);
    } catch (error) {
        console.error('Error handling tags:', error);
    }
}

app.get('/tags/top', async (req, res) => {
  try {
    const n = parseInt(req.query.n) || 10; // Get `n` from query params, default to 10
    const topTags = await Tag.find().sort({ frequency: -1 }).limit(n);
    res.status(200).json(topTags);
  } catch (error) {
    console.error('Error fetching top tags:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get("/messages", async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query; // Get page and limit from query params
        const skip = (page - 1) * limit;

        const messages = await Message.find({})
            .sort({ createdAt: -1 }) // Sort by latest
            .skip(skip)
            .limit(Number(limit)); // Paginate

        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put('/messages/:id/seen', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.userId;

        // Update the seenBy field for the given user
        await Message.findByIdAndUpdate(messageId, {
            $set: { [`seenBy.${userId}`]: true }
        });

        res.status(200).json({ message: 'Post marked as seen.' });
    } catch (error) {
        console.error('Error marking post as seen:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/messages/:position', authenticateToken, async (req, res) => {
    try {
        const position = parseInt(req.params.position);
        const userId = req.user.userId;

        if (isNaN(position) || position < 0) {
            return res.status(400).json({ message: 'Invalid position value.' });
        }

        // Filter out posts already seen by the user
        const unseenPosts = await Message.find({
            [`seenBy.${userId}`]: { $exists: false }, // User's ID is not in the seenBy map
        })
            .sort({ createdAt: -1 });

        if (position >= unseenPosts.length) {
            return res.status(404).json({ message: 'No more unseen posts available.' });
        }

        // Get the post at the specified position
        const post = unseenPosts[position];

        res.status(200).json(post);
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ message: 'An error occurred while fetching the post.' });
    }
});


// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // Directory to save images
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Ensure unique filenames
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extName = allowedTypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimeType = allowedTypes.test(file.mimetype);

        if (extName && mimeType) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"));
        }
    },
});

// Ensure the `uploads` directory exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

app.post(
    "/messages",
    authenticateToken,
    upload.single("image"), // Handle single image upload
    async (req, res) => {
        try {
            const { content } = req.body;
            let { tags } = req.body;
            const authorId = req.user.userId;
            const imageUrl = req.file ? `/uploads/${req.file.filename}` : "/uploads/no-picture.jpg";

            // Parse tags if it's a string (e.g., JSON stringified array)
            if (typeof tags === "string") {
                try {
                    tags = JSON.parse(tags);
                } catch (err) {
                    return res.status(400).json({ error: "Invalid tags format." });
                }
            }

            // Validate input
            if (!content || !tags || !Array.isArray(tags) || tags.length === 0) {
                return res
                    .status(400)
                    .json({ error: "Invalid input. Message content and at least one tag are required." });
            }

            // Process tags: normalize and update frequency in Tag collection
            await handleTags(tags);

            // Create a new message document
            const poolMessage = new Message({
                content,
                tags,
                imageUrl, // Save the image path
                authorId,
                // seenByAuthor: true, // Mark as seen by the author upon creation
                seenBy: { [authorId]: true },
            });

            // Save the message
            await poolMessage.save();

            // Increment the user's total posts
            await User.findByIdAndUpdate(authorId, { $inc: { totalPosts: 1 } });

            res.status(201).json({
                message: "Message stored successfully",
                poolData: poolMessage,
            });
        } catch (error) {
            console.error("Error storing message:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

// app.get('/user/:id', async (req, res) => {
//     try {
//       const userId = req.params.id;
//       const user = await User.findById(userId);
  
//       if (!user) {
//         return res.status(404).json({ message: 'User not found' });
//       }
  
//       const userProfile = {
//         profilePicture: user.profilePic || null,
//         username: user.username || 'Anonymous',
//         bio: user.bio || 'No bio available.',
//         preferredTags: user.preferredTags || [],
//         notPreferredTags: user.notPreferredTags || []
//       };
  
//       res.status(200).json(userProfile);
//     } catch (error) {
//       console.error('Error fetching user profile:', error);
//       res.status(500).json({ error: 'Internal Server Error' });
//     }
//   });

// Sample server route for fetching profile data
// Express.js backend (server.js)

app.get("/profile", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId; // Extracted from token in middleware
      const userProfile = await User.findById(userId);
      if (!userProfile) return res.status(404).json({ message: "User not found" });
  
      res.json({
        username: userProfile.username,
        bio: userProfile.bio || null,
        profilePicture: userProfile.profilePicture || null,
        preferredTags: userProfile.preferredTags || [],
        notPreferredTags: userProfile.notPreferredTags || [],
      });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });
  

// Serve static files from the `uploads` directory
app.use("/uploads", express.static("uploads"));

app.use(express.urlencoded({ extended: true }));

app.listen(PORT, () => {
    console.log('Server running on port:' + PORT);
});
