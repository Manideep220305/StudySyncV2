const mongoose = require('mongoose');
const Group = require('../models/Group');
const Membership = require('../models/Membership');

const ensureMembership = async (userId, groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return null;
  }
  return Membership.findOne({ userId, groupId });
};

// @desc    Create a new study group
// @route   POST /api/groups
// @frontend This is called when you submit the "Create Group" modal in Dashboard.tsx -> groupService.ts -> createGroup()
const createGroup = async (req, res) => {
  try {
    // 1. Extract payload from req.body (parsed by express.json() in app.js)
    const { name, description, tags, isPublic } = req.body;

    // 2. Defensive check: ensure `protect` middleware populated req.user
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    // 3. Normalize incoming optional fields to keep schema writes stable.
    const normalizedTags = Array.isArray(tags) ? tags : [];
    const normalizedIsPublic = typeof isPublic === 'boolean' ? isPublic : true;

    // 4. Create group with join-code retry for rare unique collisions.
    let group;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const generatedCode = Group.generateJoinCode();
        group = await Group.create({
          name,
          description,
          tags: normalizedTags,
          isPublic: normalizedIsPublic,
          joinCode: generatedCode,
          inviteCode: generatedCode,
          createdBy: req.user._id,
        });
        break;
      } catch (err) {
        if (err?.code === 11000 && (err?.keyPattern?.joinCode || err?.keyPattern?.inviteCode)) {
          continue;
        }
        throw err;
      }
    }

    if (!group) {
      return res.status(500).json({ message: 'Unable to generate a unique join code. Please retry.' });
    }

    // 5. Create leader membership. If this fails, rollback manually by removing the group.
    try {
      await Membership.create({
        userId: req.user._id,
        groupId: group._id,
        role: 'leader',
      });
    } catch (err) {
      await Group.findByIdAndDelete(group._id);
      throw err;
    }

    // 6. Send the new group back to the frontend so Dashboard.tsx can update its React state.
    return res.status(201).json(group);
  } catch (error) {
    // Log full error to server console to aid debugging (stack + message)
    console.error('Error in createGroup:', error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all public groups
// @route   GET /api/groups/public
const getGroups = async (req, res) => {
  try {
    const { tag } = req.query;
    const query = { isPublic: true };

    if (tag) {
      query.tags = tag;
    }

    const groups = await Group.find(query)
      .populate('createdBy', 'username avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json(groups);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all groups the logged-in user belongs to
// @route   GET /api/groups
// @frontend Called on initial mount in Dashboard.tsx via groupService.getUserGroups() to populate the grid.
const getUserGroups = async (req, res) => {
  try {
    // 1. Junction Query: We don't query Groups directly. We query Memberships where userId == logged_in_user.
    // .populate('groupId') tells Mongoose to swap the `groupId` string with the actual Group document object.
    const memberships = await Membership.find({ userId: req.user._id }).populate({
      path: 'groupId',
      populate: { path: 'createdBy', select: 'username avatar' },
    });

    // 2. Extract just the group ObjectIds from those memberships
    const groupIds = memberships
      .map((membership) => membership.groupId?._id)
      .filter(Boolean);

    // 3. Aggregation Pipeline: This is a complex DB query.
    // It groups matching memberships by groupId, and sums up a count.
    // Why? So the frontend card can show "12 Members" without us pushing 12 user documents over the network.
    const memberCounts = await Membership.aggregate([
      { $match: { groupId: { $in: groupIds } } },
      { $group: { _id: '$groupId', count: { $sum: 1 } } },
    ]);

    // 4. Create a quick lookup Dictionary (Map) for fast access
    const countMap = new Map(
      memberCounts.map((entry) => [entry._id.toString(), entry.count])
    );

    // 5. Structure the final response array mapping the "Group + Role + MemberCount" into flat objects
    const groups = memberships
      .filter((membership) => membership.groupId)
      .map((membership) => ({
        ...membership.groupId.toObject(),
        role: membership.role,
        memberCount: countMap.get(membership.groupId._id.toString()) ?? 0,
      }));

    // 6. Return standard JSON array to Axios parser on frontend.
    return res.status(200).json(groups);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single group details
// @route   GET /api/groups/:groupId
const getGroupById = async (req, res) => {
  try {
    const membership = await ensureMembership(req.user._id, req.params.groupId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const group = await Group.findById(req.params.groupId).populate(
      'createdBy',
      'username avatar'
    );

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    return res.status(200).json(group);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Join a group via join code
// @route   POST /api/groups/join
const joinGroup = async (req, res) => {
  try {
    const normalizedCode = String(req.body?.joinCode || '').trim().toUpperCase();

    if (!normalizedCode) {
      return res.status(400).json({ message: 'Join code is required' });
    }

    const group = await Group.findOne({
      $or: [{ joinCode: normalizedCode }, { inviteCode: normalizedCode }],
    });
    if (!group) {
      return res.status(404).json({ message: 'Invalid join code' });
    }

    await Membership.create({
      userId: req.user._id,
      groupId: group._id,
      role: 'member',
    });

    return res.status(201).json({ message: 'Joined group successfully', group });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: 'You are already a member of this group' });
    }

    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a group
// @route   DELETE /api/groups/:groupId
const deleteGroup = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await Group.findByIdAndDelete(req.params.groupId).session(session);
    await Membership.deleteMany({ groupId: req.params.groupId }).session(session);

    await session.commitTransaction();
    return res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Reset group join code
// @route   PUT /api/groups/:groupId/code
const resetJoinCode = async (req, res) => {
  try {
    const newCode = Group.generateJoinCode();
    const group = await Group.findByIdAndUpdate(
      req.params.groupId,
      { joinCode: newCode, inviteCode: newCode },
      { new: true }
    );

    return res.status(200).json({ message: 'Join code reset', joinCode: newCode, group });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Save uploaded file names metadata for a group
// @route   POST /api/groups/:groupId/files
const addGroupFiles = async (req, res) => {
  try {
    const { groupId } = req.params;
    const membership = await ensureMembership(req.user._id, groupId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const inputNames = Array.isArray(req.body.fileNames) ? req.body.fileNames : [];
    const normalizedNames = inputNames
      .map((name) => String(name || '').trim())
      .filter(Boolean)
      .slice(0, 20);

    if (!normalizedNames.length) {
      return res.status(400).json({ message: 'fileNames is required' });
    }

    const filesToAdd = normalizedNames.map((name) => ({
      name,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    }));

    const group = await Group.findByIdAndUpdate(
      groupId,
      { $push: { uploadedFiles: { $each: filesToAdd } } },
      { new: true }
    ).populate('uploadedFiles.uploadedBy', 'username');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    return res.status(201).json({
      message: 'File names saved',
      uploadedFiles: group.uploadedFiles || [],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get uploaded file names metadata for a group
// @route   GET /api/groups/:groupId/files
const getGroupFiles = async (req, res) => {
  try {
    const { groupId } = req.params;
    const membership = await ensureMembership(req.user._id, groupId);
    if (!membership) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const group = await Group.findById(groupId).populate('uploadedFiles.uploadedBy', 'username');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    return res.status(200).json(group.uploadedFiles || []);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getUserGroups,
  getGroupById,
  joinGroup,
  deleteGroup,
  resetJoinCode,
  addGroupFiles,
  getGroupFiles,
};
