const API_URL = "https://api.buffer.com";

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) throw new Error("Missing BUFFER_ACCESS_TOKEN");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`Buffer API error: ${JSON.stringify(json.errors || json)}`);
  }
  return json.data as T;
}

export type BufferChannel = { id: string; name: string; displayName: string; service: string };

export async function getChannels(): Promise<BufferChannel[]> {
  const orgData = await gql<{ account: { organizations: Array<{ id: string }> } }>(
    `query GetOrganizations { account { organizations { id } } }`
  );
  const orgId = orgData.account.organizations[0]?.id;
  if (!orgId) throw new Error("No Buffer organization found");

  const chanData = await gql<{ channels: BufferChannel[] }>(
    `query GetChannels($orgId: OrganizationId!) {
      channels(input: { organizationId: $orgId }) {
        id
        name
        displayName
        service
      }
    }`,
    { orgId }
  );
  return chanData.channels;
}

export async function createTextPost(channelId: string, text: string): Promise<void> {
  const data = await gql<{ createPost: { __typename: string; message?: string } }>(
    `mutation CreatePost($channelId: ChannelId!, $text: String!) {
      createPost(input: {
        text: $text,
        channelId: $channelId,
        schedulingType: automatic,
        mode: addToQueue
      }) {
        ... on PostActionSuccess {
          post { id }
        }
        ... on MutationError {
          message
        }
      }
    }`,
    { channelId, text }
  );
  if (data.createPost.__typename === "MutationError") {
    throw new Error(data.createPost.message || "Buffer post creation failed");
  }
}
