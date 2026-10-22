"""PyTorch Neural Autoencoder for numerical sensor telemetry reconstruction anomaly scoring."""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from ml.models.base import BaseAnomalyDetector

# Lazy import check for PyTorch
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


class PyTorchAutoencoderModule(nn.Module if HAS_TORCH else object):
    """Symmetric feed-forward neural autoencoder with bottleneck compression."""

    def __init__(self, input_dim: int, hidden_dims: Optional[List[int]] = None):
        super().__init__()
        hidden_dims = hidden_dims or [max(input_dim // 2, 4), max(input_dim // 4, 2)]

        # Encoder
        encoder_layers: List[nn.Module] = []
        in_d = input_dim
        for h_d in hidden_dims:
            encoder_layers.append(nn.Linear(in_d, h_d))
            encoder_layers.append(nn.BatchNorm1d(h_d))
            encoder_layers.append(nn.LeakyReLU(0.1))
            in_d = h_d
        self.encoder = nn.Sequential(*encoder_layers)

        # Decoder
        decoder_layers: List[nn.Module] = []
        rev_dims = list(reversed(hidden_dims[:-1])) + [input_dim]
        in_d = hidden_dims[-1]
        for idx, h_d in enumerate(rev_dims):
            decoder_layers.append(nn.Linear(in_d, h_d))
            if idx < len(rev_dims) - 1:
                decoder_layers.append(nn.BatchNorm1d(h_d))
                decoder_layers.append(nn.LeakyReLU(0.1))
            in_d = h_d
        self.decoder = nn.Sequential(*decoder_layers)

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded


class AutoencoderDetector(BaseAnomalyDetector):
    """Autoencoder anomaly detector scoring via per-sample Mean Squared Reconstruction Error (MSE)."""

    def __init__(
        self,
        hidden_dims: Optional[List[int]] = None,
        learning_rate: float = 1e-3,
        batch_size: int = 64,
        epochs: int = 25,
        early_stopping_patience: int = 5,
        device: str = "cpu",
        random_state: int = 42,
    ):
        super().__init__(
            model_name="autoencoder",
            model_version="0.1.0",
            random_state=random_state,
        )
        self.hidden_dims = hidden_dims
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.epochs = epochs
        self.early_stopping_patience = early_stopping_patience
        self.device = device
        self.module: Optional[PyTorchAutoencoderModule] = None

    def fit(self, X: Union[pd.DataFrame, np.ndarray], y: Optional[np.ndarray] = None) -> AutoencoderDetector:
        if not HAS_TORCH:
            raise RuntimeError("PyTorch is required to fit AutoencoderDetector.")

        torch.manual_seed(self.random_state)
        np.random.seed(self.random_state)

        arr = self._validate_input_features(X)
        n_samples, n_features = arr.shape

        self.module = PyTorchAutoencoderModule(input_dim=n_features, hidden_dims=self.hidden_dims)
        self.module.to(self.device)

        # Create validation split (last 15% chronological)
        val_size = max(int(n_samples * 0.15), 10)
        train_x = arr[:-val_size] if n_samples > val_size * 2 else arr
        val_x = arr[-val_size:] if n_samples > val_size * 2 else arr

        train_tensor = torch.tensor(train_x, dtype=torch.float32)
        val_tensor = torch.tensor(val_x, dtype=torch.float32).to(self.device)

        dataset = TensorDataset(train_tensor)
        loader = DataLoader(dataset, batch_size=min(self.batch_size, len(train_x)), shuffle=True)

        optimizer = torch.optim.Adam(self.module.parameters(), lr=self.learning_rate, weight_decay=1e-5)
        criterion = nn.MSELoss()

        best_val_loss = float("inf")
        patience_counter = 0

        self.module.train()
        for epoch in range(self.epochs):
            for batch in loader:
                b_x = batch[0].to(self.device)
                optimizer.zero_grad()
                recon = self.module(b_x)
                loss = criterion(recon, b_x)
                loss.backward()
                optimizer.step()

            # Validation loss evaluation
            self.module.eval()
            with torch.no_grad():
                val_recon = self.module(val_tensor)
                val_loss = criterion(val_recon, val_tensor).item()
            self.module.train()

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= self.early_stopping_patience:
                    break

        self.module.eval()
        # Compute baseline reconstruction error distribution
        with torch.no_grad():
            full_tensor = torch.tensor(arr, dtype=torch.float32).to(self.device)
            recon = self.module(full_tensor)
            mse = torch.mean((recon - full_tensor) ** 2, dim=1).cpu().numpy()

        self.min_score_ = float(np.min(mse))
        # 99.5th percentile + margin
        self.max_score_ = float(np.percentile(mse, 99.5) * 1.5 + 1e-4)

        self.is_fitted = True
        return self

    def score(self, X: Union[pd.DataFrame, np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        if not HAS_TORCH or self.module is None:
            raise RuntimeError("Autoencoder model is not initialized or PyTorch is unavailable.")

        arr = self._validate_input_features(X)
        self.module.eval()
        with torch.no_grad():
            tensor = torch.tensor(arr, dtype=torch.float32).to(self.device)
            recon = self.module(tensor)
            # Per-sample MSE reconstruction error
            raw_scores = torch.mean((recon - tensor) ** 2, dim=1).cpu().numpy()

        normalized_scores = self._normalize_scores(raw_scores, higher_is_anomalous=True)
        return raw_scores, normalized_scores

    def get_feature_reconstruction_errors(self, X: Union[pd.DataFrame, np.ndarray]) -> np.ndarray:
        """Compute squared reconstruction error per feature channel: (x - x_hat)^2."""
        arr = self._validate_input_features(X)
        self.module.eval()
        with torch.no_grad():
            tensor = torch.tensor(arr, dtype=torch.float32).to(self.device)
            recon = self.module(tensor)
            sq_err = ((recon - tensor) ** 2).cpu().numpy()
        return sq_err

    def get_params(self) -> Dict[str, Any]:
        params = super().get_params()
        params.update({
            "hidden_dims": self.hidden_dims,
            "learning_rate": self.learning_rate,
            "batch_size": self.batch_size,
            "epochs": self.epochs,
            "device": self.device,
        })
        return params
