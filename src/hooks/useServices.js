import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchServices, getCachedServices } from '../api/services';

export default function useServices() {
  const cachedPage = getCachedServices();
  const [services, setServices] = useState(() => cachedPage?.services || []);
  const [loading, setLoading] = useState(() => !cachedPage);
  const [error, setError] = useState('');

  const loadServices = useCallback(async ({ showLoader = false, force = false } = {}) => {
    try {
      if (showLoader) setLoading(true);
      setError('');
      const backendServices = await fetchServices({ force });
      setServices(backendServices.services || backendServices);
    } catch (loadError) {
      setError(loadError.message || 'Live services could not be loaded.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices({ showLoader: true });
  }, [loadServices]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadServices();
    });
    return () => {
      subscription.remove();
    };
  }, [loadServices]);

  return {
    services,
    loading,
    error,
    retry: () => loadServices({ showLoader: true, force: true }),
  };
}



