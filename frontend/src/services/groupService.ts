import { apiClient, unwrapApiData } from '@/services/apiClient';

// Types matching backend schemas
export interface Group {
  _id: string;
  name: string;
  description?: string;
  joinCode: string;
  createdBy: { _id: string; username: string; avatar?: string };
  role?: 'leader' | 'member';
  memberCount?: number;
}

export interface Message {
  _id: string;
  groupId: string;
  senderId: { _id: string; username: string; avatar?: string };
  text: string;
  type: 'text' | 'system' | 'quiz';
  createdAt: string;
}

export interface GroupUploadedFile {
  _id?: string;
  name: string;
  uploadedAt: string;
  uploadedBy?: {
    _id?: string;
    username?: string;
  };
}

// Create new group
export const createGroup = async (groupData: { name: string; description?: string; tags?: string[]; isPublic?: boolean }) => {
  const response = await apiClient.post('/groups', groupData);
  return unwrapApiData(response.data);
};

// Get user's groups
export const getUserGroups = async (): Promise<Group[]> => {
  const response = await apiClient.get('/groups');
  return unwrapApiData<Group[]>(response.data);
};

// Get public groups
export const getPublicGroups = async (): Promise<Group[]> => {
  const response = await apiClient.get('/groups/public');
  return unwrapApiData<Group[]>(response.data);
};

// Get single group
export const getGroup = async (groupId: string): Promise<Group> => {
  const response = await apiClient.get(`/groups/${groupId}`);
  return unwrapApiData<Group>(response.data);
};

// Join group via code
export const joinGroup = async (joinCode: string) => {
  const response = await apiClient.post('/groups/join', { joinCode });
  return unwrapApiData(response.data);
};

// Get group members
export const getGroupMembers = async (groupId: string) => {
  const response = await apiClient.get(`/groups/${groupId}/members`);
  return unwrapApiData(response.data);
};

// Kick/promote member (leader only)
export const kickMember = async (groupId: string, userId: string) => {
  const response = await apiClient.delete(`/groups/${groupId}/members/${userId}`);
  return unwrapApiData(response.data);
};

export const promoteToLeader = async (groupId: string, userId: string) => {
  const response = await apiClient.patch(`/groups/${groupId}/members/${userId}`);
  return unwrapApiData(response.data);
};

// Get messages (REST fallback for history)
export const getMessages = async (groupId: string, limit = 50): Promise<Message[]> => {
  const response = await apiClient.get(`/groups/${groupId}/messages?limit=${limit}`);
  return unwrapApiData<Message[]>(response.data);
};

export const getGroupFiles = async (groupId: string): Promise<GroupUploadedFile[]> => {
  const response = await apiClient.get(`/groups/${groupId}/files`);
  return unwrapApiData<GroupUploadedFile[]>(response.data);
};

export const addGroupFiles = async (groupId: string, fileNames: string[]) => {
  const response = await apiClient.post(`/groups/${groupId}/files`, { fileNames });
  return unwrapApiData<{ message: string; uploadedFiles: GroupUploadedFile[] }>(response.data);
};

export default {
  createGroup,
  getUserGroups,
  getPublicGroups,
  getGroup,
  joinGroup,
  getGroupMembers,
  kickMember,
  promoteToLeader,
  getMessages,
  getGroupFiles,
  addGroupFiles,
};

