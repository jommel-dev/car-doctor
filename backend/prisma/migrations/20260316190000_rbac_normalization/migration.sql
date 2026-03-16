-- RBAC normalization migration for SaaS Base Projects
-- Date: 2026-03-16
--
-- Goal:
-- 1) Keep existing legacy tables (`tblrbac`, `tblusers`) compatible.
-- 2) Introduce normalized permission model for module/menu/tab/action-level control.
-- 3) Support role-based permissions and optional user overrides.
--
-- Safe to run multiple times (idempotent statements).

BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_permission_keys (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  module TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'feature',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_permission_keys_scope_check CHECK (scope IN ('feature', 'menu', 'tab', 'action'))
);

CREATE TABLE IF NOT EXISTS public.auth_role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES public.tblrbac(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES public.auth_permission_keys(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_role_permissions_role_id
  ON public.auth_role_permissions(role_id);

CREATE INDEX IF NOT EXISTS idx_auth_role_permissions_permission_id
  ON public.auth_role_permissions(permission_id);

CREATE TABLE IF NOT EXISTS public.auth_user_permission_overrides (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.tblusers(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES public.auth_permission_keys(id) ON DELETE CASCADE,
  effect TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_user_permission_overrides_effect_check CHECK (effect IN ('allow', 'deny')),
  UNIQUE(user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_user_permission_overrides_user_id
  ON public.auth_user_permission_overrides(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_user_permission_overrides_permission_id
  ON public.auth_user_permission_overrides(permission_id);

CREATE TABLE IF NOT EXISTS public.auth_user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.tblusers(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES public.tblrbac(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_user_roles_user_id
  ON public.auth_user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role_id
  ON public.auth_user_roles(role_id);

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_permission_keys_updated_at ON public.auth_permission_keys;
CREATE TRIGGER trg_auth_permission_keys_updated_at
BEFORE UPDATE ON public.auth_permission_keys
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_auth_user_permission_overrides_updated_at ON public.auth_user_permission_overrides;
CREATE TRIGGER trg_auth_user_permission_overrides_updated_at
BEFORE UPDATE ON public.auth_user_permission_overrides
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

INSERT INTO public.auth_permission_keys(key, label, module, scope)
VALUES
  ('dashboard.view', 'View Dashboard', 'dashboard', 'feature'),

  ('customers.view', 'View Customers', 'customers', 'feature'),
  ('customers.create', 'Create Customer', 'customers', 'action'),
  ('customers.edit', 'Edit Customer', 'customers', 'action'),
  ('customers.delete', 'Delete Customer', 'customers', 'action'),

  ('quotation.view', 'View Quotation', 'quotation', 'feature'),

  ('job-orders.view', 'View Job Orders', 'job-orders', 'feature'),
  ('job-orders.create', 'Create Job Orders', 'job-orders', 'action'),
  ('job-orders.edit', 'Edit Job Orders', 'job-orders', 'action'),

  ('inventory.view', 'View Inventory', 'inventory', 'feature'),

  ('pos.view', 'View POS / For Payments', 'pos', 'feature'),

  ('reports.view', 'View Reports', 'reports', 'feature'),

  ('user-management.view', 'View User Management', 'user-management', 'feature'),
  ('user-management.create', 'Create User', 'user-management', 'action'),
  ('user-management.edit', 'Edit User', 'user-management', 'action'),
  ('user-management.delete', 'Delete User', 'user-management', 'action'),

  ('security.view', 'View Security Access', 'security', 'feature'),
  ('security.edit', 'Edit Security Access', 'security', 'action')
ON CONFLICT (key) DO NOTHING;

WITH role_tokens AS (
  SELECT
    r.id AS role_id,
    lower(trim(token)) AS token,
    'menu'::text AS source
  FROM public.tblrbac r
  CROSS JOIN LATERAL regexp_split_to_table(
    COALESCE(to_jsonb(r)->>'roleMenus', to_jsonb(r)->>'rolemenus', ''),
    ','
  ) AS token
  WHERE trim(token) <> ''

  UNION ALL

  SELECT
    r.id AS role_id,
    lower(trim(token)) AS token,
    'permission'::text AS source
  FROM public.tblrbac r
  CROSS JOIN LATERAL regexp_split_to_table(
    COALESCE(to_jsonb(r)->>'rolePermission', to_jsonb(r)->>'rolepermission', ''),
    ','
  ) AS token
  WHERE trim(token) <> ''
), normalized_tokens AS (
  SELECT
    role_id,
    source,
    regexp_replace(token, '[^a-z0-9]+', '-', 'g') AS slug
  FROM role_tokens
), ensured_permissions AS (
  INSERT INTO public.auth_permission_keys(key, label, module, scope)
  SELECT DISTINCT
    CASE
      WHEN source = 'menu' THEN CONCAT('legacy.menu.', slug)
      ELSE CONCAT('legacy.permission.', slug)
    END AS key,
    CONCAT('Legacy ', initcap(source), ': ', slug) AS label,
    'legacy' AS module,
    CASE
      WHEN source = 'menu' THEN 'menu'
      ELSE 'action'
    END AS scope
  FROM normalized_tokens
  WHERE slug <> ''
  ON CONFLICT (key) DO NOTHING
  RETURNING id, key
)
INSERT INTO public.auth_role_permissions(role_id, permission_id)
SELECT DISTINCT
  nt.role_id,
  pk.id AS permission_id
FROM normalized_tokens nt
JOIN public.auth_permission_keys pk
  ON pk.key = CASE
    WHEN nt.source = 'menu' THEN CONCAT('legacy.menu.', nt.slug)
    ELSE CONCAT('legacy.permission.', nt.slug)
  END
WHERE nt.slug <> ''
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.auth_user_roles(user_id, role_id, is_primary)
SELECT DISTINCT
  u.id AS user_id,
  NULLIF(
    COALESCE(
      to_jsonb(u)->>'roleId',
      to_jsonb(u)->>'roleid',
      to_jsonb(u)->>'role_id'
    ),
    ''
  )::bigint AS role_id,
  TRUE AS is_primary
FROM public.tblusers u
WHERE NULLIF(
  COALESCE(
    to_jsonb(u)->>'roleId',
    to_jsonb(u)->>'roleid',
    to_jsonb(u)->>'role_id'
  ),
  ''
) IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

CREATE OR REPLACE VIEW public.v_auth_user_effective_permissions AS
WITH role_grants AS (
  SELECT
    ur.user_id,
    rp.permission_id,
    TRUE AS granted_by_role
  FROM public.auth_user_roles ur
  JOIN public.auth_role_permissions rp
    ON rp.role_id = ur.role_id
), user_overrides AS (
  SELECT
    user_id,
    permission_id,
    MAX(CASE WHEN effect = 'allow' THEN 1 ELSE 0 END) AS has_allow,
    MAX(CASE WHEN effect = 'deny' THEN 1 ELSE 0 END) AS has_deny
  FROM public.auth_user_permission_overrides
  GROUP BY user_id, permission_id
), all_candidates AS (
  SELECT user_id, permission_id FROM role_grants
  UNION
  SELECT user_id, permission_id FROM user_overrides
)
SELECT
  c.user_id,
  c.permission_id,
  pk.key AS permission_key,
  pk.label AS permission_label,
  pk.module,
  pk.scope,
  CASE
    WHEN COALESCE(uo.has_deny, 0) = 1 THEN FALSE
    WHEN COALESCE(uo.has_allow, 0) = 1 THEN TRUE
    WHEN rg.granted_by_role IS TRUE THEN TRUE
    ELSE FALSE
  END AS is_allowed,
  CASE
    WHEN COALESCE(uo.has_deny, 0) = 1 THEN 'user-deny'
    WHEN COALESCE(uo.has_allow, 0) = 1 THEN 'user-allow'
    WHEN rg.granted_by_role IS TRUE THEN 'role'
    ELSE 'none'
  END AS source
FROM all_candidates c
JOIN public.auth_permission_keys pk
  ON pk.id = c.permission_id
LEFT JOIN role_grants rg
  ON rg.user_id = c.user_id AND rg.permission_id = c.permission_id
LEFT JOIN user_overrides uo
  ON uo.user_id = c.user_id AND uo.permission_id = c.permission_id;

COMMIT;