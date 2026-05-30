import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, MenuItem, TextField, Table, TableHead, TableRow,
  TableCell, TableBody, Stack, Alert,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import api from '../api';
import PageActionBar from '../components/PageActionBar';

/**
 * Comptabilité — read-only page for the accountant role (also accessible to admins).
 * Picks a month + year, lets the user download the monthly sales CSV, and shows a preview table of
 * the platform commissions for that month.
 *
 * Driven by:
 *   - GET /api/accounting/platforms?month=&year=  → preview JSON
 *   - GET /api/accounting/sales.csv?month=&year=  → CSV download
 */

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function formatEur(value) {
  if (value == null) return '—';
  return `${Number(value).toFixed(2).replace('.', ',')} €`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function AccountingPage() {
  const today = new Date();
  // Default to the previous month — accounting work is typically retrospective.
  const defaultDate = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, []);

  const [month, setMonth] = useState(defaultDate.month);
  const [year, setYear] = useState(defaultDate.year);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const years = useMemo(() => {
    const current = today.getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - i + 1).sort((a, b) => b - a);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    api.getAccountingPlatforms(month, year)
      .then((data) => { if (mounted) setPreview(data); })
      .catch((err) => { if (mounted) setError(err.message || 'Impossible de charger l’aperçu.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [month, year]);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await api.downloadAccountingSalesCsv(month, year);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const mm = String(month).padStart(2, '0');
      a.download = `ventes-${year}-${mm}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Téléchargement impossible.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box>
      <PageActionBar
        title="Comptabilité"
        actionsBefore={[
          {
            icon: <DescriptionIcon />,
            tooltip: 'Télécharger le CSV des ventes',
            onClick: handleDownload,
            color: 'primary',
            disabled: downloading,
            ariaLabel: 'Télécharger le CSV des ventes',
          },
        ]}
      />

      <Box sx={{ maxWidth: { xs: '100%', md: 960 }, mx: 'auto', px: { xs: 0, sm: 1 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                select
                label="Mois"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                fullWidth
                sx={{ maxWidth: { xs: '100%', sm: 200 } }}
              >
                {MONTHS.map((label, i) => (
                  <MenuItem key={i} value={i + 1}>{label}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Année"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                fullWidth
                sx={{ maxWidth: { xs: '100%', sm: 140 } }}
              >
                {years.map((y) => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </TextField>
              <Typography variant="body2" color="text.secondary">
                CSV mensuel des factures de vente (écritures comptables) + détail des commissions plateformes.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Commissions plateformes</Typography>
              {preview && (
                <Typography variant="body2" color="text.secondary">
                  Total commissions du mois : <strong>{formatEur(preview.totalCommission)}</strong>
                </Typography>
              )}
            </Stack>

            {loading && <Typography variant="body2" color="text.secondary">Chargement…</Typography>}

            {!loading && preview && preview.rows.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Aucun encaissement plateforme ce mois-là.
              </Typography>
            )}

            {!loading && preview && preview.rows.length > 0 && (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Plateforme</TableCell>
                      <TableCell>Encaissement</TableCell>
                      <TableCell>Net total séjour</TableCell>
                      <TableCell>Brut payé client</TableCell>
                      <TableCell>Commission</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.rows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{formatDate(row.date)}</TableCell>
                        <TableCell>{row.client}</TableCell>
                        <TableCell>{row.platform}</TableCell>
                        <TableCell>{formatEur(row.encaissement)}</TableCell>
                        <TableCell>{formatEur(row.net)}</TableCell>
                        <TableCell>{formatEur(row.gross)}</TableCell>
                        <TableCell>{formatEur(row.commission)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
