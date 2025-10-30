import express from 'express';
import { createUser } from '../controllers/myfrind.js';

const router = express.Router();

// Create a new user and optionally record creator in MyFriend
router.post('/create', createUser);

export default router;


