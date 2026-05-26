import { formatPrice, LLMModel } from "@/lib/settings-utils";

type ModelDetailModalProps = {
  modelDetail: LLMModel | null;
  onClose: () => void;
};

export default function ModelDetailModal({ modelDetail, onClose }: ModelDetailModalProps) {
  if (!modelDetail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1a1a24] border border-white/10 rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-bold">{modelDetail.name}</h3>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white text-2xl leading-none"
              aria-label="Close model details"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-medium text-white/40 mb-1">ID</h4>
              <p className="font-mono text-sm">{modelDetail.id}</p>
            </div>

            {modelDetail.description && (
              <div>
                <h4 className="text-xs font-medium text-white/40 mb-1">Description</h4>
                <p className="text-sm leading-relaxed text-white/70">{modelDetail.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-white/40 mb-1">Prompt Price</h4>
                <p className="text-sm text-white/60">{formatPrice(modelDetail.pricing.prompt)}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-white/40 mb-1">Completion Price</h4>
                <p className="text-sm text-white/60">{formatPrice(modelDetail.pricing.completion)}</p>
              </div>
              {modelDetail.context_length && (
                <div>
                  <h4 className="text-xs font-medium text-white/40 mb-1">Context Length</h4>
                  <p className="text-sm text-white/60">{modelDetail.context_length.toLocaleString()} tokens</p>
                </div>
              )}
              {modelDetail.architecture?.modality && (
                <div>
                  <h4 className="text-xs font-medium text-white/40 mb-1">Modality</h4>
                  <p className="text-sm text-white/60">{modelDetail.architecture.modality}</p>
                </div>
              )}
              {modelDetail.architecture?.tokenizer && (
                <div>
                  <h4 className="text-xs font-medium text-white/40 mb-1">Tokenizer</h4>
                  <p className="text-sm text-white/60">{modelDetail.architecture.tokenizer}</p>
                </div>
              )}
              {modelDetail.architecture?.instruct_type && (
                <div>
                  <h4 className="text-xs font-medium text-white/40 mb-1">Instruct Type</h4>
                  <p className="text-sm text-white/60">{modelDetail.architecture.instruct_type}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
