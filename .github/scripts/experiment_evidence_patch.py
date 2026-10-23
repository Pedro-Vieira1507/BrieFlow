from pathlib import Path

path = Path("src/components/briefflow/ExperimentComparison.tsx")
text = path.read_text()

import_anchor = 'import { Button } from "@/components/ui/button";\n'
import_line = 'import { ExperimentEvidencePanel } from "./ExperimentEvidencePanel";\n'
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit("Button import anchor not found")
    text = text.replace(import_anchor, import_anchor + import_line, 1)

handler_anchor = "  const handleWinner = async (variant: SavedLibraryAsset) => {\n"
handler = '''  const handleImportedMetrics = (savedMetrics: AssetExperimentMetrics[]) => {
    setData((current) =>
      current
        ? {
            ...current,
            metrics: [
              ...savedMetrics,
              ...current.metrics.filter(
                (metric) =>
                  !savedMetrics.some(
                    (savedMetric) => savedMetric.asset_id === metric.asset_id,
                  ),
              ),
            ],
          }
        : current,
    );
    setDrafts((current) => {
      const next = { ...current };
      savedMetrics.forEach((metric) => {
        next[metric.asset_id] = toDraft(metric);
      });
      return next;
    });
  };

'''
if "const handleImportedMetrics" not in text:
    if handler_anchor not in text:
        raise SystemExit("Winner handler anchor not found")
    text = text.replace(handler_anchor, handler + handler_anchor, 1)

render_anchor = '      <div className="grid gap-4 lg:grid-cols-2">\n'
render = '''      <ExperimentEvidencePanel
        variants={data.variants}
        metrics={data.metrics}
        onMetricsImported={handleImportedMetrics}
      />

'''
if "onMetricsImported={handleImportedMetrics}" not in text:
    if render_anchor not in text:
        raise SystemExit("Variant grid anchor not found")
    text = text.replace(render_anchor, render + render_anchor, 1)

path.write_text(text)
