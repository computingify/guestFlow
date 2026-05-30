import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PageActionBar from '../components/PageActionBar';
import ChangePasswordForm from '../components/ChangePasswordForm';
import { useAuth } from '../hooks/useAuth';

/**
 * Page de changement de mot de passe — commune à tous les utilisateurs authentifiés
 * (admin et comptable). Route: /settings/password.
 *
 * Le serveur autorise déjà POST /api/auth/change-password pour n'importe quel rôle (route self).
 *
 * Premier changement forcé (mustChangePassword=true) : le serveur détruit la session après le
 * succès (specs/admin-account-management.md §3.3 rule 15). Le hook `useAuth` est mis à jour
 * (setUser(null)) et la page redirige immédiatement vers /login avec un snackbar one-shot. Les
 * changements volontaires (mustChangePassword=false) conservent la session et restent sur la page.
 */
export default function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);

  const wasMustChange = Boolean(user && user.mustChangePassword);

  const handleSubmit = async (currentPassword, newPassword) => {
    await changePassword(currentPassword, newPassword, { wasMustChange });
    if (wasMustChange) {
      navigate('/login?reason=password-changed', { replace: true });
    }
  };

  return (
    <Box>
      <PageActionBar
        title="Changer le mot de passe"
        subtitle={user?.email ? (
          <Typography variant="caption" color="text.disabled">
            {user.email}
          </Typography>
        ) : null}
      />

      <Box sx={{ maxWidth: { xs: '100%', md: 480 }, mx: 'auto', px: { xs: 0, sm: 1 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choisissez un nouveau mot de passe d'au moins 10 caractères.
              {wasMustChange && (
                <>
                  {' '}
                  Vous serez ensuite redirigé vers la page de connexion pour vous reconnecter avec
                  votre nouveau mot de passe.
                </>
              )}
            </Typography>
            {message && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
                {message}
              </Alert>
            )}
            <ChangePasswordForm
              onSubmit={handleSubmit}
              onSuccess={() => {
                if (!wasMustChange) setMessage('Mot de passe mis à jour.');
              }}
            />
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
