-- Free-tier hygiene: single UPDATE policy on control_users + purge stale demo sessions
-- Keeps commerce/user/sales demo data intact. Does not drop indexes.

DROP POLICY IF EXISTS control_users_update_admin ON public.control_users;
DROP POLICY IF EXISTS control_users_update ON public.control_users;

CREATE POLICY control_users_update
  ON public.control_users
  FOR UPDATE
  TO authenticated
  USING (
    (id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1
      FROM public.commerce_memberships self_membership
      JOIN public.commerce_memberships peer_membership
        ON peer_membership.commerce_id = self_membership.commerce_id
       AND peer_membership.user_id = control_users.id
      WHERE self_membership.user_id = (SELECT auth.uid())
        AND self_membership.status = 'active'
        AND self_membership.role_key = ANY (ARRAY['owner'::text, 'admin'::text])
    ))
    OR (EXISTS (
      SELECT 1
      FROM public.control_users cu
      WHERE cu.id = (SELECT auth.uid())
        AND cu.status = 'active'
        AND cu.role_key = 'admin'
    ))
  )
  WITH CHECK (
    (id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1
      FROM public.commerce_memberships self_membership
      JOIN public.commerce_memberships peer_membership
        ON peer_membership.commerce_id = self_membership.commerce_id
       AND peer_membership.user_id = control_users.id
      WHERE self_membership.user_id = (SELECT auth.uid())
        AND self_membership.status = 'active'
        AND self_membership.role_key = ANY (ARRAY['owner'::text, 'admin'::text])
    ))
    OR (EXISTS (
      SELECT 1
      FROM public.control_users cu
      WHERE cu.id = (SELECT auth.uid())
        AND cu.status = 'active'
        AND cu.role_key = 'admin'
    ))
  );

DELETE FROM public.control_user_sessions
WHERE revoked_at IS NOT NULL
   OR expires_at < now()
   OR last_seen_at < (now() - interval '14 days');

-- 3) Old password-reset request rows (demo noise)
DELETE FROM public.control_user_password_reset_requests
WHERE requested_at < (now() - interval '7 days')
   OR status IN ('used','expired','cancelled','completed','done');
