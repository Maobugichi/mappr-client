import { applyChangeProposal, previewTechStackChange, rejectChangeProposal } from './api';
import { OverviewChangeController } from './overview-change';
import { assertChangeRejection } from './change-protocol';
import { ChangeProtocolError } from './overview-change-contract';
import { assertTechStackProposal, assertTechStackReceipt, type TechStackChangeRequest, type TechStackProposal } from './tech-stack-change-contract';
import type { ChangeProtocol } from './change-protocol';

export class TechStackChangeController extends OverviewChangeController<TechStackProposal, TechStackChangeRequest> {
  constructor(owner: OverviewChangeController) {
    const protocol: ChangeProtocol<TechStackProposal, TechStackChangeRequest> = {
      scope: 'tech-stack', label: 'Tech Stack', context: () => ({ activeView: 'tech-stack', selectedTarget: null }),
      request: (instruction, revision, context, base) => {
        if (new Set(base.techStack.map((item) => item.category)).size !== base.techStack.length) {
          throw new ChangeProtocolError('Tech Stack categories must identify entries unambiguously before requesting a change. The inventory is preserved.');
        }
        return { instruction, context, expectedBaseRevision: revision };
      },
      preview: previewTechStackChange, validateProposal: assertTechStackProposal,
      apply: applyChangeProposal, validateReceipt: assertTechStackReceipt,
      reject: async (mapId, proposalId, baseRevision) => {
        const result = await rejectChangeProposal(mapId, proposalId, baseRevision);
        assertChangeRejection(result.data, mapId, proposalId, baseRevision);
        return result;
      },
    };
    const { data, revision } = owner.getSnapshot().canonical;
    super(owner.mapId, data, revision ?? undefined, { protocol, authority: owner });
  }
}
