import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { LeadController } from '../controllers/lead.controller';

const router = Router();
const leadController = new LeadController();

router.use(authenticateToken);

router.get('/', leadController.getLeads.bind(leadController));
router.get('/:id', leadController.getLeadById.bind(leadController));
router.post('/', leadController.createLead.bind(leadController));
router.put('/:id', leadController.updateLead.bind(leadController));
router.delete('/:id', leadController.deleteLead.bind(leadController));
router.post('/:id/qualify', leadController.qualifyLead.bind(leadController));
router.post('/bulk', leadController.bulkUpdate.bind(leadController));

export { router as leadRoutes };
