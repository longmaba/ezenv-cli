export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }

  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

export type OutputFormat = 'env' | 'json' | 'yaml' | 'export';

export function formatSecrets(secrets: Record<string, string>, format: OutputFormat): string {
  switch (format) {
    case 'env':
      return formatEnv(secrets);
    case 'json':
      return formatJson(secrets);
    case 'yaml':
      return formatYaml(secrets);
    case 'export':
      return formatExport(secrets);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function formatEnv(secrets: Record<string, string>): string {
  const lines: string[] = [];
  
  for (const [key, value] of Object.entries(secrets)) {
    // Escape quotes and handle multiline values
    const escapedValue = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
    
    // Use quotes if value contains special characters
    if (value.includes(' ') || value.includes('\n') || value.includes('"') || value.includes("'")) {
      lines.push(`${key}="${escapedValue}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  
  return lines.join('\n');
}

function formatJson(secrets: Record<string, string>): string {
  return JSON.stringify(secrets, null, 2);
}

function formatYaml(secrets: Record<string, string>): string {
  const lines: string[] = [];
  
  for (const [key, value] of Object.entries(secrets)) {
    // Handle multiline values
    if (value.includes('\n')) {
      lines.push(`${key}: |`);
      const indentedValue = value.split('\n').map(line => `  ${line}`).join('\n');
      lines.push(indentedValue);
    } else {
      // Escape quotes for YAML
      const escapedValue = value.replace(/"/g, '\\"');
      
      // Use quotes if value contains special characters
      if (value.includes(':') || value.includes('#') || value.includes('@') || value.startsWith(' ') || value.endsWith(' ') || value.includes('//')) {
        lines.push(`${key}: "${escapedValue}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  }
  
  return lines.join('\n');
}

function formatExport(secrets: Record<string, string>): string {
  const lines: string[] = [];
  
  for (const [key, value] of Object.entries(secrets)) {
    // Escape for shell
    const escapedValue = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
    
    lines.push(`export ${key}="${escapedValue}"`);
  }
  
  return lines.join('\n');
}