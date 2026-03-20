const Membership = require('../models/Membership');

// @desc    List all members in a group
// @route   GET /api/groups/:groupId/members
// @frontend Called when the GroupChat.tsx side panel requests the active member list
const getGroupMembers = async (req, res) => {
    try {
        const requesterMembership = await Membership.findOne({
            userId: req.user._id,
            groupId: req.params.groupId,
        });
        if (!requesterMembership) {
            return res.status(403).json({ message: 'Not a member of this group' });
        }

        // 1. Query the Membership junction table for everyone linked to this group.
        // 2. .populate() fetches the User details (username, avatar) for each linked ID.
        // 3. .sort({ role: 1 }) sorts alphabetically: 'leader' comes before 'member' so leaders appear at top!
        const members = await Membership.find({ groupId: req.params.groupId })
            .populate('userId', 'username email avatar totalPoints')
            .sort({ role: 1 }); 

        res.status(200).json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Kick a member from a group (Leader only)
// @route   DELETE /api/groups/:groupId/members/:userId
// @frontend Accessed via a "Kick" button by the Leader in GroupChat.tsx -> memberService
// IMPORTANT: This route is safeguarded by `requireRole('leader')` in the routes file.
const kickMember = async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        // 1. Prevent leader from kicking themselves (they should delete group instead)
        const targetMember = await Membership.findOne({ userId, groupId });
        if (targetMember && targetMember.role === 'leader') {
            return res.status(400).json({ message: 'Leader cannot be kicked. Delete the group instead.' });
        }

        // 2. Remove the junction document entirely. They are no longer part of the group.
        await Membership.findOneAndDelete({ userId, groupId });

        res.status(200).json({ message: 'Member kicked successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const promoteToLeader = async (req, res) => {
    try {
        const { groupId, userId } = req.params;
        
        // Only current leader can promote
        const callerMembership = await Membership.findOne({ 
            userId: req.user._id, 
            groupId 
        });
        if (callerMembership.role !== 'leader') {
            return res.status(403).json({ message: 'Only leaders can promote' });
        }
        
        // Update target to leader (transfer ownership)
        await Membership.findOneAndUpdate(
            { userId, groupId },
            { role: 'leader' }
        );
        
        // Downgrade caller to member
        await Membership.findOneAndUpdate(
            { userId: req.user._id, groupId },
            { role: 'member' }
        );
        
        res.status(200).json({ message: 'Leader promoted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getGroupMembers,
    kickMember,
    promoteToLeader
};
