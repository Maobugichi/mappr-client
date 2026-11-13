import { applyArchitectureChange, previewArchitectureChange, rejectArchitectureChange } from './api';
import { OverviewChangeController } from './overview-change';
import { ChangeProtocolError } from './overview-change-contract';
import { assertArchitectureProposal, assertArchitectureReceipt, assertArchitectureRejection,
  type ArchitectureChangeRequest, type ArchitectureContext, type ArchitectureProposal } from './architecture-change-contract';
import type { ChangeProtocol } from './change-protocol';

export class ArchitectureChangeController extends OverviewChangeController<ArchitectureProposal, ArchitectureChangeRequest> {
  private selection: { target: ArchitectureContext['selectedTarget'] };
  constructor(owner: OverviewChangeController) {
    const selection: { target: ArchitectureContext['selectedTarget'] } = { target: null };
    const protocol: ChangeProtocol<ArchitectureProposal, ArchitectureChangeRequest> = {
      scope: 'architecture', label: 'Architecture',
      context: () => ({ activeView: 'architecture', selectedTarget: selection.target ? { ...selection.target } : null }),
      request: (instruction, revision, context, base) => {
        const target = context.selectedTarget;
        if (target && base.architecture.nodes.filter((node) => node.id === target.id).length !== 1) {
          throw new ChangeProtocolError('The selected canonical node is no longer available. Select an existing node or choose the whole architecture.');
        }
        return { instruction, context, expectedBaseRevision: revision };
      },
      preview: previewArchitectureChange, validateProposal: assertArchitectureProposal,
      apply: applyArchitectureChange, validateReceipt: assertArchitectureReceipt,
      reject: async (mapId, proposalId, baseRevision) => {
        const result = await rejectArchitectureChange(mapId, proposalId, baseRevision);
        assertArchitectureRejection(result.data, mapId, proposalId, baseRevision);
        return result;
      },
    };
    const { data, revision } = owner.getSnapshot().canonical;
    super(owner.mapId, data, revision ?? undefined, { protocol, authority: owner });
    this.selection = selection;
  }
  setTarget = (id: string | null) => {
    this.selection.target = id === null ? null : { kind: 'architecture_node', id };
  };
}
