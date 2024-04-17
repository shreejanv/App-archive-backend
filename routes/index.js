const express = require("express");
const { getDb } = require("../database");
const bycrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const router = express.Router();

router.post("/signup", async (req, res) => {
  const { email, password, username } = req.body;
  const db = await getDb();

  let passwordHash = await bycrypt.hash(password, 10);

  await db.collection("users").insertOne({
    username,
    email,
    password: passwordHash,
    followers: [],
    following: [],
  });
  res.send("User created");
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const db = await getDb();

  const user = await db.collection("users").findOne({ username });
  if (!user) {
    return res.status(400).send("Invalid username or password");
  }

  const isPasswordValid = await bycrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(403).send("Invalid username or password");
  }
  res.send("Logged in");
});

router.post("/post", async (req, res) => {
  try {
    const { title, content, username } = req.body;
    const db = await getDb();

    const newPost = {
      title,
      content,
      username,
      likes: 0,
    };

    await db.collection("posts").insertOne(newPost);

    res
      .status(201)
      .json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).send("An error occurred while creating post");
  }
});

router.get("/post/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const db = await getDb();

    const posts = await db.collection("posts").find({ username }).toArray();

    if (posts.length === 0) {
      return res.status(404).send("No posts found for the specified username");
    }

    res.status(200).json(posts);
  } catch (error) {
    console.error("Error retrieving posts:", error);
    res.status(500).send("An error occurred while retrieving posts");
  }
});

router.delete("/post/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const _id = new ObjectId(id);
    const db = await getDb();

    const result = await db.collection("posts").deleteOne({ _id });

    if (result.deletedCount === 0) {
      return res.status(404).send("Post not found");
    }

    res.status(200).send("Post deleted successfully");
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).send("An error occurred while deleting post");
  }
});

router.put("/post/like/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const _id = new ObjectId(id);
    const db = await getDb();

    const updatedPost = await db
      .collection("posts")
      .findOneAndUpdate(
        { _id },
        { $inc: { likes: 1 } },
        { returnOriginal: false },
      );

    if (!updatedPost.value) {
      return res.status(404).send("Post not found");
    }

    res.status(200).send("Post liked");
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).send("An error occurred while liking post");
  }
});

router.put("/follow/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { follower } = req.body;
    const db = await getDb();

    const followUserPromise = db.collection("users").updateOne(
      { username },
      {
        $push: {
          followers: follower,
        },
      },
    );

    const addFollowerPromise = db.collection("users").updateOne(
      { username: follower },
      {
        $push: {
          following: username,
        },
      },
    );

    await Promise.all([followUserPromise, addFollowerPromise]);

    res.status(200).send("Followed successfully");
  } catch (error) {
    console.error("Error following user:", error);
    res.status(500).send("An error occurred while following user");
  }
});

router.get("/connections/:username", async (req, res) => {
  const { username } = req.params;
  const db = await getDb();
  const user = await db.collection("users").findOne({ username });
  res.status(200).json({
    following: user.following,
    followers: user.followers,
  });
});

router.delete("/unfollow/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { follower } = req.body;
    const db = await getDb();

    const unfollowUserPromise = db.collection("users").updateOne(
      { username },
      {
        $pull: {
          followers: follower,
        },
      },
    );

    const removeFollowerPromise = db.collection("users").updateOne(
      { username: follower },
      {
        $pull: {
          following: username,
        },
      },
    );

    await Promise.all([unfollowUserPromise, removeFollowerPromise]);

    res.status(200).send("Unfollowed successfully");
  } catch (error) {
    console.error("Error unfollowing user:", error);
    res.status(500).send("An error occurred while unfollowing user");
  }
});

module.exports = router;
