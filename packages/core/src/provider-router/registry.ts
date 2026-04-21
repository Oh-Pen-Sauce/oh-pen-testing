import {
  type AIProvider,
  type Config,
  type ProviderId,
  ProviderError,
} from "@oh-pen-testing/shared";

export interface ProviderFactoryInput {
  config: Config;
  /** Primary API credential if the provider needs one. */
  apiKey?: string;
  /** Override the model string. */
  model?: string;
}

export type ProviderFactory = (
  input: ProviderFactoryInput,
) => Promise<AIProvider> | AIProvider;

const registry: Map<ProviderId, ProviderFactory> = new Map();

export function registerProvider(
  id: ProviderId,
  factory: ProviderFactory,
): void {
  registry.set(id, factory);
}

export function listRegisteredProviders(): ProviderId[] {
  return Array.from(registry.keys());
}

export async function resolveProvider(
  input: ProviderFactoryInput,
): Promise<AIProvider> {
  const id = input.config.ai.primary_provider;
  const factory = registry.get(id);
  if (!factory) {
    throw new ProviderError(
      `Provider "${id}" is not registered. Registered: ${listRegisteredProviders().join(", ") || "(none)"}`,
    );
  }
  return factory(input);
}

export function clearRegistry(): void {
  registry.clear();
}
