use anyhow::{Context, Result};
use qdrant_client::{
    Qdrant,
    qdrant::{
        vectors_config::Config, CreateCollection, Distance, PointStruct, VectorParams,
        VectorsConfig,
    },
};

const COLLECTION_NAME: &str = "sensedesk";
const DIMENSION: u64 = 768; // Based on Matryoshka learning strategy for Gemini output

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
        self.client
            .upsert_points(
                qdrant_client::qdrant::UpsertPointsBuilder::new(COLLECTION_NAME, points)
            )
            .await?;
        Ok(())
    }
}
