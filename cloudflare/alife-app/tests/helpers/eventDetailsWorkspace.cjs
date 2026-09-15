async function showDetailsPane(page, pane) {
  const workspace = page.locator('.event-details-workspace:visible');
  await workspace.waitFor();
  if (await workspace.getAttribute('data-wide') === 'true') {
    if (pane === 'assistant' && await workspace.getAttribute('data-assistant-open') !== 'true') await workspace.getByRole('button', { name: /Show assistant|展开助手/ }).click();
  } else await workspace.getByRole('tab', { name: pane === 'form' ? /Details form|资料表单/ : /AI assistant|AI 助手/, exact: true }).click();
}
async function expandTranslation(group) {
  const details = group.locator('.event-detail-translation');
  if (await details.count() && await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
}
module.exports = { showDetailsPane, expandTranslation };
