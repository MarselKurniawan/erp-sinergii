CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _feature_key text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'superadmin') THEN
    RETURN TRUE;
  END IF;
  SELECT CASE _action
    WHEN 'view' THEN can_view
    WHEN 'create' THEN can_create
    WHEN 'edit' THEN can_edit
    WHEN 'delete' THEN can_delete
    ELSE FALSE
  END INTO v_has
  FROM public.user_permissions
  WHERE user_id = _user_id AND feature_key = _feature_key;
  RETURN COALESCE(v_has, FALSE);
END;
$function$;