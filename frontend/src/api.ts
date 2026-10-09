export const apiGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`/api${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
};
