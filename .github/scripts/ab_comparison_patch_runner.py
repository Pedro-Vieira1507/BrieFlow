from pathlib import Path
import textwrap

source = Path('.github/workflows/ab-comparison-patch.yml').read_text()
marker = '      - name: Align migrations and add experiment layer\n        shell: bash\n        run: |\n'
start = source.index(marker) + len(marker)
end = source.index('      - name: Format and validate\n', start)
script = textwrap.dedent(source[start:end])

fragile_start = script.index("history_button_anchor = '''")
fragile_end = script.index("history_section_anchor = '''", fragile_start)

robust = '''library_path = Path("src/components/briefflow/LibraryModal.tsx")
library_text = library_path.read_text()
history_token = """                          disabled={loadingVersions}
                          onClick={() => void handleToggleHistory()}"""
history_position = library_text.index(history_token)
button_start = library_text.rfind("                        <Button\\n", 0, history_position)
if button_start < 0:
    raise SystemExit("history button start not found")
comparison_button = """                        {selectedItem.experiment_group_id &&
                        selectedItem.variant_label ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-pressed={comparisonOpen}
                            onClick={() => setComparisonOpen((open) => !open)}
                            className="w-full rounded-xl border-border-strong bg-surface-2 text-xs font-semibold text-fg-secondary hover:bg-surface-3 hover:text-fg-primary sm:w-auto"
                          >
                            <GitCompareArrows className="mr-1.5 size-4" />
                            {comparisonOpen ? "Ocultar A/B" : "Comparar A/B"}
                          </Button>
                        ) : null}
"""
library_path.write_text(
    library_text[:button_start] + comparison_button + library_text[button_start:]
)

'''

script = script[:fragile_start] + robust + script[fragile_end:]
Path('/tmp/ab-patch.sh').write_text(script)
