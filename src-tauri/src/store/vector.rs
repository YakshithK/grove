use anyhow::{Context, Result};
use qdrant_client::{
    Qdrant,
    qdrant::{
        vectors_config::Config, Distance, PointStruct, VectorParams,
        VectorsConfig, SearchPoints, 
    },
};

const COLLECTION_NAME: &str = "sensedesk";
const DIMENSION: u64 = 768;

pub struct VectorStore {
    client: Qdrant,
}

impl VectorStore {
    pub fn new() -> Result<Self> {
        let client = Qdrant::from_url("http://localhost:6334").build()?;
        Ok(Self { client })
    }

    pub async fn ensure_collection(&self) -> Result<()> {
        if !self.client.collection_exists(COLLECTION_NAME).await? {
            self.client
                .create_collection(
                    qdrant_client::qdrant::CreateCollectionBuilder::new(COLLECTION_NAME)
                    .vectors_config(VectorsConfig {
                        config: Some(Config::Params(VectorParams {
                            size: DIMENSION,
                            distance: Distance::Cosine.into(),
                            ..Default::default()
                        })),
                    })
                )
                .await
                .context("Failed to create Qdrant collection")?;
        }
        Ok(())
    }

    pub async fn upsert_points(&self, points: Vec<PointStruct>) -> Result<()> {
        if points.is_empty() {
            return Ok(());
        }
        self.client
            .upsert_points(
                qdrant_client::qdrant::UpsertPointsBuilder::new(COLLECTION_NAME, points)
            )
            .await?;
        Ok(())
    }

    pub async fn search(&self, query_vector: Vec<f32>, limit: u64) -> Result<Vec<qdrant_client::qdrant::ScoredPoint>> {
        let results = self.client
            .search_points(
                SearchPoints {
                    collection_name: COLLECTION_NAME.to_string(),
                    vector: query_vector,
                    limit,
                    with_payload: Some(true.into()),
                    ..Default::default()
                }
            )
            .await
            .context("Failed to search Qdrant")?;
        Ok(results.result)
    }

    pub async fn delete_collection(&self) -> Result<()> {
        if self.client.collection_exists(COLLECTION_NAME).await? {
            self.client.delete_collection(COLLECTION_NAME).await?;
        }
        Ok(())
    }
}
