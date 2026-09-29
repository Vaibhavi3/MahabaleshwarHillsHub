import React, { useEffect, useState } from 'react';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';
import { FiMapPin, FiPlus, FiEdit2, FiTrash2, FiCheckCircle } from 'react-icons/fi';
import AddressForm from '../components/AddressForm';

const Addresses = () => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState(null); // null | 'new' | address object being edited
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const response = await api.getAddresses();
      setAddresses(response.data);
    } catch (error) {
      toast.error('Failed to load your addresses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaved = () => {
    setFormMode(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this address?')) return;
    setBusyId(id);
    try {
      await api.deleteAddress(id);
      toast.success('Address removed');
      load();
    } catch (error) {
      toast.error('Could not remove address');
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (id) => {
    setBusyId(id);
    try {
      await api.setDefaultAddress(id);
      load();
    } catch (error) {
      toast.error('Could not update default address');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-ink">Your Addresses</h1>
        {formMode !== 'new' && (
          <button onClick={() => setFormMode('new')} className="btn-primary flex items-center gap-1.5">
            <FiPlus /> Add New Address
          </button>
        )}
      </div>

      {formMode === 'new' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-ink mb-4">Add a New Address</h2>
          <AddressForm onSaved={handleSaved} onCancel={() => setFormMode(null)} />
        </div>
      )}

      {addresses.length === 0 && formMode !== 'new' ? (
        <div className="flex flex-col items-center text-center py-16 px-4 bg-white rounded-lg shadow">
          <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center mb-4">
            <FiMapPin className="text-muted" size={24} />
          </div>
          <p className="font-bold text-ink mb-1">No saved addresses yet</p>
          <p className="text-sm text-muted mb-5 max-w-sm">
            Save an address here so checkout is a tap away next time.
          </p>
          <button onClick={() => setFormMode('new')} className="btn-primary">
            Add Your First Address
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr) =>
            formMode?.id === addr.id ? (
              <div key={addr.id} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-ink mb-4">Edit Address</h2>
                <AddressForm initial={addr} onSaved={handleSaved} onCancel={() => setFormMode(null)} />
              </div>
            ) : (
              <div key={addr.id} className="bg-white rounded-lg shadow p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="filter-chip filter-chip-inactive !cursor-default">{addr.label}</span>
                      {addr.is_default && (
                        <span className="flex items-center gap-1 text-xs font-bold uppercase text-brand">
                          <FiCheckCircle size={13} /> Default
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-ink">{addr.full_name}</p>
                    <p className="text-sm text-muted mt-0.5">
                      {addr.address_line}, {addr.city}, {addr.state} {addr.postal_code}, {addr.country}
                    </p>
                    <p className="text-sm text-muted mt-0.5">Phone: {addr.phone}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex gap-3">
                      <button onClick={() => setFormMode(addr)} className="text-ink hover:text-brand" title="Edit">
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(addr.id)}
                        disabled={busyId === addr.id}
                        className="text-ink hover:text-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                    {!addr.is_default && (
                      <button
                        onClick={() => handleSetDefault(addr.id)}
                        disabled={busyId === addr.id}
                        className="text-xs font-semibold uppercase text-brand hover:underline disabled:opacity-50"
                      >
                        Set as default
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Addresses;
