-- Seed brand rules: Reveries and Rare Character are NDP.
-- Uses INSERT ... ON CONFLICT DO NOTHING so it's safe to re-run (idempotent).

INSERT INTO "BrandRule" ("brand", "brandKey", "distillery", "category", "ndp", "createdAt", "updatedAt")
VALUES
  ('The Reveries',  'the reveries',  NULL, 'Bourbon', true, NOW(), NOW()),
  ('Reveries',      'reveries',      NULL, 'Bourbon', true, NOW(), NOW()),
  ('Rare Character','rare character', NULL, 'Bourbon', true, NOW(), NOW())
ON CONFLICT ("brandKey") DO NOTHING;
