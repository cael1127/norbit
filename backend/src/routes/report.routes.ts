import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ReportController } from '../controllers/report.controller';

const router = Router();
const reportController = new ReportController();

router.use(authenticateToken);

router.get('/dashboard', reportController.getDashboardMetrics.bind(reportController));
router.get('/leads', reportController.getLeadReport.bind(reportController));
router.get('/outreach', reportController.getOutreachReport.bind(reportController));
router.get('/calendar', reportController.getCalendarReport.bind(reportController));
router.get('/workflows', reportController.getWorkflowReport.bind(reportController));
router.get('/export/:type', reportController.exportReport.bind(reportController));

export { router as reportRoutes };
