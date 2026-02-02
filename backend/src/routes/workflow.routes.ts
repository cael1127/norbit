import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { WorkflowController } from '../controllers/workflow.controller';

const router = Router();
const workflowController = new WorkflowController();

router.use(authenticateToken);

router.get('/', workflowController.getWorkflows.bind(workflowController));
router.get('/:id', workflowController.getWorkflowById.bind(workflowController));
router.post('/', workflowController.createWorkflow.bind(workflowController));
router.put('/:id', workflowController.updateWorkflow.bind(workflowController));
router.delete('/:id', workflowController.deleteWorkflow.bind(workflowController));
router.post('/:id/execute', workflowController.executeWorkflow.bind(workflowController));
router.get('/:id/executions', workflowController.getExecutions.bind(workflowController));

export { router as workflowRoutes };
