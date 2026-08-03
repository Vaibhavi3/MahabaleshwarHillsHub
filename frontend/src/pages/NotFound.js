import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => (
  <div className="container mx-auto px-4 py-24 text-center">
    <h1 className="text-6xl font-bold gradient-text mb-4">404</h1>
    <p className="text-xl text-gray-600 mb-8">This page doesn't exist.</p>
    <Link to="/" className="btn-primary">
      Back to Home
    </Link>
  </div>
);

export default NotFound;
