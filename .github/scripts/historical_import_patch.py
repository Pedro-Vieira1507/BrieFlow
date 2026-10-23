from pathlib import Path

path = Path("src/components/briefflow/ExperimentEvidencePanel.tsx")
source = path.read_text()

old_import = 'import { ExperimentHistoryPanel } from "./ExperimentHistoryPanel";\n'
new_import = old_import + 'import { ExperimentHistoricalImport } from "./ExperimentHistoricalImport";\n'
if old_import not in source:
    raise SystemExit("ExperimentEvidencePanel history import anchor not found")
source = source.replace(old_import, new_import, 1)

old_return = '  return (\n    <div className="space-y-4">\n'
new_return = old_return + '      <ExperimentHistoricalImport\n        variants={variants}\n        onMetricsImported={onMetricsImported}\n      />\n'
if old_return not in source:
    raise SystemExit("ExperimentEvidencePanel return anchor not found")
source = source.replace(old_return, new_return, 1)

path.write_text(source)
