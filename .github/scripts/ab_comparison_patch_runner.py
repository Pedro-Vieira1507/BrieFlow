from pathlib import Path
import textwrap

source = Path('.github/workflows/ab-comparison-patch.yml').read_text()
marker = '      - name: Align migrations and add experiment layer\n        shell: bash\n        run: |\n'
start = source.index(marker) + len(marker)
end = source.index('      - name: Format and validate\n', start)
script = textwrap.dedent(source[start:end])

button_block_start = script.index("history_button_anchor = '''")
button_block_end = script.index("history_section_anchor = '''", button_block_start)
button_patch = '''library_path = Path("src/components/briefflow/LibraryModal.tsx")
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
script = script[:button_block_start] + button_patch + script[button_block_end:]

section_block_start = script.index("history_section_anchor = '''")
section_block_end = script.index(
    'replace_once(\n    "tests/campaign-history.test.mjs"',
    section_block_start,
)
section_patch = '''library_path = Path("src/components/briefflow/LibraryModal.tsx")
library_text = library_path.read_text()
campaign_tabs_token = "                    <CampaignTabs\\n"
campaign_tabs_position = library_text.index(campaign_tabs_token)
comparison_section = """                    {comparisonOpen && selectedItem.experiment_group_id ? (
                      <ExperimentComparison
                        experimentGroupId={selectedItem.experiment_group_id}
                      />
                    ) : null}

"""
library_path.write_text(
    library_text[:campaign_tabs_position]
    + comparison_section
    + library_text[campaign_tabs_position:]
)

'''
script = script[:section_block_start] + section_patch + script[section_block_end:]
Path('/tmp/ab-patch.sh').write_text(script)
