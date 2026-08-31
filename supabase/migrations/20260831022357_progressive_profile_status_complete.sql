-- El flujo de perfil progresivo usa pending/complete, mientras que cuentas
-- anteriores ya podían tener los estados de onboarding previos.
alter table public.commerce_accounts
  drop constraint if exists commerce_accounts_onboarding_status_check;

alter table public.commerce_accounts
  add constraint commerce_accounts_onboarding_status_check
  check (onboarding_status in ('pending', 'complete', 'draft', 'ready', 'live', 'paused'));
