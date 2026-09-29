import React, { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2, FiPlus, FiCheck, FiMapPin } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../api/axiosConfig';

const LABELS = ['Home', 'Work', 'Other'];

const EMPTY_FORM = {
  label: 'Home',
  full_name: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
  is_default: false,
};

const AddressForm = ({ initial, onCancel, onSaved, saveFn, showDefaultToggle }) => {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveFn(form);
      onSaved(saved);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save address');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-surface">
      <div className="flex gap-2">
        {LABELS.map((l) => (
          <button
            type="button"
            key={l}
            onClick={() => setForm((f) => ({ ...f, label: l }))}
            className={`filter-chip ${form.label === l ? 'filter-chip-active' : 'filter-chip-inactive'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Full Name</label>
          <input name="full_name" value={form.full_name} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted mb-1">Address (House No, Street, Area)</label>
        <input name="address_line1" value={form.address_line1} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted mb-1">Landmark (optional)</label>
        <input name="address_line2" value={form.address_line2} onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">City</label>
          <input name="city" value={form.city} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">State</label>
          <input name="state" value={form.state} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">PIN Code</label>
          <input name="postal_code" value={form.postal_code} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      {showDefaultToggle && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="is_default" checked={form.is_default} onChange={handleChange} />
          Set as default address
        </label>
      )}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Address'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
};

/**
 * Saved-address book: list, add, edit, delete, and mark a default address.
 * With `selectable`, addresses render as radio cards and `onSelect` fires
 * with the chosen address (auto-selecting the default on load) - used at
 * checkout. Without it, it's a plain manage view for the account page.
 */
const AddressBook = ({ selectable = false, onSelect }) => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState(null); // null | 'new' | address id being edited
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.getAddresses();
      setAddresses(data);
      if (selectable) {
        const preferred = data.find((a) => a.is_default) || data[0];
        setSelectedId(preferred ? preferred.id : null);
      }
      if (data.length === 0) setFormMode('new');
    } catch (error) {
      toast.error('Failed to load your saved addresses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectable) return;
    const selected = addresses.find((a) => a.id === selectedId);
    if (selected && onSelect) onSelect(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, addresses, selectable]);

  const handleSelect = (id) => {
    if (selectable) setSelectedId(id);
  };

  const handleCreate = async (form) => {
    const { data } = await api.createAddress(form);
    return data;
  };

  const handleUpdate = (id) => async (form) => {
    const { data } = await api.updateAddress(id, form);
    return data;
  };

  const onFormSaved = (saved) => {
    setAddresses((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      const next = exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
      return saved.is_default ? next.map((a) => (a.id === saved.id ? a : { ...a, is_default: false })) : next;
    });
    setFormMode(null);
    if (selectable) setSelectedId(saved.id);
    toast.success('Address saved');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      await api.deleteAddress(id);
      toast.success('Address removed');
      load();
    } catch (error) {
      toast.error('Could not delete address');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.setDefaultAddress(id);
      setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
    } catch (error) {
      toast.error('Could not update default address');
    }
  };

  if (loading) {
    return <p className="text-sm text-muted">Loading your addresses...</p>;
  }

  return (
    <div className="space-y-3">
      {addresses.map((addr) =>
        formMode === addr.id ? (
          <AddressForm
            key={addr.id}
            initial={{ ...addr, address_line2: addr.address_line2 || '' }}
            saveFn={handleUpdate(addr.id)}
            onSaved={onFormSaved}
            onCancel={() => setFormMode(null)}
            showDefaultToggle={!addr.is_default}
          />
        ) : (
          <div
            key={addr.id}
            onClick={() => handleSelect(addr.id)}
            className={`border rounded-lg p-4 flex items-start gap-3 transition-colors ${
              selectable ? 'cursor-pointer' : ''
            } ${
              selectable && selectedId === addr.id
                ? 'border-brand ring-1 ring-brand bg-brand-light/10'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {selectable && (
              <input
                type="radio"
                name="selected-address"
                checked={selectedId === addr.id}
                onChange={() => handleSelect(addr.id)}
                className="mt-1 accent-brand shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-surface text-ink">
                  <FiMapPin className="text-brand" size={11} /> {addr.label}
                </span>
                {addr.is_default && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-brand-light/30 text-brand-dark">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-ink">
                {addr.full_name} <span className="font-normal text-muted">· {addr.phone}</span>
              </p>
              <p className="text-sm text-muted">
                {addr.address_line1}
                {addr.address_line2 ? `, ${addr.address_line2}` : ''}, {addr.city}, {addr.state}{' '}
                {addr.postal_code}, {addr.country}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs font-semibold uppercase tracking-wide">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormMode(addr.id);
                  }}
                  className="flex items-center gap-1 text-ink hover:text-brand"
                >
                  <FiEdit2 size={12} /> Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(addr.id);
                  }}
                  className="flex items-center gap-1 text-ink hover:text-red-600"
                >
                  <FiTrash2 size={12} /> Remove
                </button>
                {!addr.is_default && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefault(addr.id);
                    }}
                    className="flex items-center gap-1 text-ink hover:text-brand"
                  >
                    <FiCheck size={12} /> Set as default
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {formMode === 'new' ? (
        <AddressForm
          saveFn={handleCreate}
          onSaved={onFormSaved}
          onCancel={() => (addresses.length > 0 ? setFormMode(null) : null)}
          showDefaultToggle={addresses.length > 0}
        />
      ) : (
        <button
          type="button"
          onClick={() => setFormMode('new')}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand hover:text-brand-dark"
        >
          <FiPlus /> Add New Address
        </button>
      )}
    </div>
  );
};

export default AddressBook;
