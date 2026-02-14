import { test, expect } from '../../fixtures/base';
import { BinFormPage } from '../../pages/bin-form.page';
import { SEEDED_BINS } from '../../fixtures/test-data';

test.describe('Bin Edit', () => {
  let form: BinFormPage;
  const bin = SEEDED_BINS[0];

  test.beforeEach(async ({ page }) => {
    form = new BinFormPage(page);
    await form.gotoEdit(bin.id);
  });

  test('loads existing bin data', async () => {
    await expect(form.nameInput).toHaveValue(bin.name);
  });

  test('can update bin name', async ({ page }) => {
    const newName = `Updated ${bin.name}`;
    await form.nameInput.clear();
    await form.nameInput.fill(newName);
    await form.submit();
    await expect(page).toHaveURL(new RegExp(`/bins/${bin.id}`));
    // Restore original name
    await form.gotoEdit(bin.id);
    await form.nameInput.clear();
    await form.nameInput.fill(bin.name);
    await form.submit();
  });

  test('can update bin type', async () => {
    await expect(form.binTypeSelect).toBeVisible();
    await form.binTypeSelect.selectOption('paper');
    // Reset
    await form.binTypeSelect.selectOption('mixed');
  });

  test('active checkbox is present in edit mode', async () => {
    await expect(form.isActiveCheckbox).toBeVisible();
  });

  test('can toggle active status', async () => {
    const isChecked = await form.isActiveCheckbox.isChecked();
    if (isChecked) {
      await form.isActiveCheckbox.uncheck();
    } else {
      await form.isActiveCheckbox.check();
    }
    // Reset
    if (isChecked) {
      await form.isActiveCheckbox.check();
    } else {
      await form.isActiveCheckbox.uncheck();
    }
  });

  test('cancel navigates to detail page', async ({ page }) => {
    await form.cancelLink.click();
    await expect(page).toHaveURL(new RegExp(`/bins/${bin.id}`));
  });
});
