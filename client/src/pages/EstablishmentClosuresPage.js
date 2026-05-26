import React, { useEffect, useState } from 'react';
import {
  Box, IconButton, TextField, TableHead, TableBody, TableRow, TableCell,
  Tooltip, MenuItem, Alert, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageActionBar from '../components/PageActionBar';
import TableCard from '../components/TableCard';
import FormDialog from '../components/FormDialog';
import { useAppDialogs } from '../components/DialogProvider';
import api from '../api';
import { displayDate } from '../utils/formatters';

const EMPTY_FORM = {
  propertyId: '',
  label: 'Fermeture établissement',
  startDate: '',
  endDate: '',
};

export default function EstablishmentClosuresPage() {
  const { confirm, alert } = useAppDialogs();
  const [closures, setClosures] = useState([]);
  const [properties, setProperties] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dialogError, setDialogError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [closuresList, propsList] = await Promise.all([
      api.getEstablishmentClosures(),
      api.getProperties(),
    ]);
    setClosures(closuresList || []);
    setProperties(propsList || []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogError('');
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      propertyId: row.propertyId == null ? '' : String(row.propertyId),
      label: row.label || 'Fermeture établissement',
      startDate: row.startDate || '',
      endDate: row.endDate || '',
    });
    setDialogError('');
    setDialogOpen(true);
  };

  const submitDisabled = !form.startDate || !form.endDate || form.startDate >= form.endDate || saving;

  const handleSave = async () => {
    setSaving(true);
    setDialogError('');
    const payload = {
      propertyId: form.propertyId === '' ? null : Number(form.propertyId),
      label: form.label,
      startDate: form.startDate,
      endDate: form.endDate,
    };
    try {
      if (editId) {
        await api.updateEstablishmentClosure(editId, payload);
      } else {
        await api.createEstablishmentClosure(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setDialogError(err.error || err.message || "Impossible d'enregistrer cette fermeture.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Confirmer la suppression',
      message: 'Supprimer cette période de fermeture ?',
      confirmLabel: 'Supprimer',
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await api.deleteEstablishmentClosure(id);
      await load();
    } catch (err) {
      await alert({ title: 'Erreur', message: err.message || 'Impossible de supprimer cette fermeture.' });
    }
  };

  const propertyNameById = (id) => {
    const p = properties.find((x) => Number(x.id) === Number(id));
    return p ? p.name : `#${id}`;
  };

  return (
    <Box>
      <PageActionBar
        title="Fermetures de l'établissement"
        actionsBefore={[{
          icon: <AddIcon />,
          tooltip: 'Ajouter une fermeture',
          onClick: openCreate,
          color: 'primary',
          variant: 'contained',
        }]}
      />

      <Box sx={{ maxWidth: 920, mx: 'auto', px: { xs: 0, sm: 1 } }}>
        <TableCard minWidth={760}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Logement</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Libellé</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Début</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Fin</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {closures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 3, fontStyle: 'italic' }}>
                    Aucune fermeture configurée
                  </Typography>
                </TableCell>
              </TableRow>
            ) : closures.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  {row.propertyId == null ? (
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                      Tous les logements
                    </Typography>
                  ) : (
                    row.propertyName || propertyNameById(row.propertyId)
                  )}
                </TableCell>
                <TableCell>{row.label || 'Fermeture établissement'}</TableCell>
                <TableCell>{displayDate(row.startDate)}</TableCell>
                <TableCell>{displayDate(row.endDate)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Modifier">
                    <IconButton size="small" onClick={() => openEdit(row)} aria-label="Modifier">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Supprimer">
                    <IconButton size="small" color="error" onClick={() => handleDelete(row.id)} aria-label="Supprimer">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableCard>
      </Box>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editId ? 'Modifier la fermeture' : 'Ajouter une fermeture'}
        onSubmit={handleSave}
        submitDisabled={submitDisabled}
        submitLabel={saving ? 'Enregistrement…' : 'Enregistrer'}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {dialogError && <Alert severity="error">{dialogError}</Alert>}
          <TextField
            select
            label="Logement concerné"
            value={form.propertyId}
            onChange={(e) => setForm((prev) => ({ ...prev, propertyId: e.target.value }))}
            fullWidth
            helperText="Sélectionnez « Tous les logements » pour une fermeture globale."
          >
            <MenuItem value="">Tous les logements</MenuItem>
            {properties.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Libellé"
            value={form.label}
            onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Début fermeture"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Fin fermeture"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Box>
      </FormDialog>
    </Box>
  );
}
