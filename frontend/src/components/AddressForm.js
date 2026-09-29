import React, { useState } from 'react';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';

const LABELS = ['Home', 'Work', 'Other'];

const EMPTY_ADDRESS = {
  label: 'Home',
  full_name: '',
  phone: '',
  address_line: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
};

const inputClass = 'w-full border rounded-lg px-4 py-2 text-sm';

// Shared add/edit form for a saved address - used on both the Address Book
// page (account settings) and inline during checkout, mirroring the
// Myntra/Nykaa/Ajio "add a new address" form.
const AddressForm = ({ initial, onSaved, onCancel }) => {
  const [form, setForm] = useState(() => ({ ...EMPTY_ADDRESS, ...(initial || {}) }));
  const [isDefault, setIsDefault] = useState(initial?.is_default || false);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, is_default: isDefault };
      const response = initial?.id
        ? await api.updateAddress(initial.id, payload)
        : await api.createAddress(payload);
      toast.success('Address saved');
      onSaved(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save address');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-ink mb-1.5">Save as</label>
        <div className="flex gap-2">
          {LABELS.map((l) => (
            <button
              type="button"
              key={l}
              onClick={() => setForm({ ...form, label: l })}
              className={`filter-chip ${form.label === l ? 'filter-chip-active' : 'filter-chip-inactive'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input name="full_name" value={form.full_name} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            required
            pattern="[0-9+ ]{6,20}"
            title="Enter a valid phone number"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Address</label>
        <input name="address_line" value={form.address_line} onChange={handleChange} required className={inputClass} placeholder="House no., street, area" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">City</label>
          <input name="city" value={form.city} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">State</label>
          <input name="state" value={form.state} onChange={handleChange} required className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Postal Code</label>
          <input name="postal_code" value={form.postal_code} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Country</label>
          <input name="country" value={form.country} onChange={handleChange} required className={inputClass} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="accent-brand w-4 h-4"
        />
        <span className="text-ink">Set as default address</span>
      </label>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Address'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default AddressForm;
