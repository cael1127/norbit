import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { CalendarController } from '../controllers/calendar.controller';

const router = Router();
const calendarController = new CalendarController();

router.use(authenticateToken);

router.get('/oauth/authorize', calendarController.authorize.bind(calendarController));
router.get('/oauth/callback', calendarController.oauthCallback.bind(calendarController));
router.get('/events', calendarController.getEvents.bind(calendarController));
router.post('/events', calendarController.createEvent.bind(calendarController));
router.put('/events/:id', calendarController.updateEvent.bind(calendarController));
router.delete('/events/:id', calendarController.deleteEvent.bind(calendarController));
router.get('/availability', calendarController.checkAvailability.bind(calendarController));

export { router as calendarRoutes };
