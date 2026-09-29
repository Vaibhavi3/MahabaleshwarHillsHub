import React from 'react';
import AddressBook from '../components/AddressBook';

const Addresses = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Your Addresses</h1>
      <p className="text-sm text-muted mb-6">
        Save addresses here so you can pick one at checkout instead of typing it every time.
      </p>
      <AddressBook />
    </div>
  );
};

export default Addresses;
