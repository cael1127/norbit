import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ConversationController } from '../controllers/conversation.controller';

const router = Router();
const conversationController = new ConversationController();

router.use(authenticateToken);

router.get('/', conversationController.getConversations.bind(conversationController));
router.get('/:id', conversationController.getConversationById.bind(conversationController));
router.post('/', conversationController.createConversation.bind(conversationController));
router.post('/:id/messages', conversationController.sendMessage.bind(conversationController));
router.get('/:id/messages', conversationController.getMessages.bind(conversationController));

export { router as conversationRoutes };
