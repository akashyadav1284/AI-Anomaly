"""Abstract base class and return structure for time-series dataset loaders."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union
import pandas as pd
from ml.data.schemas import DatasetMetadata


@dataclass
class LoadedDataset:
    """Standardized return container holding dataframe and sidecar metadata."""
    data: pd.DataFrame
    metadata: DatasetMetadata


class BaseDatasetLoader(ABC):
    """Abstract interface governing dataset loaders."""

    @abstractmethod
    def load(self, source_path: Union[str, Path]) -> LoadedDataset:
        """Load dataset from path, mapping into the standardized common schema."""
        pass
