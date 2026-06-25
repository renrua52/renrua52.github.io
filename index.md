---
layout: single
permalink: /
author_profile: true
classes: wide
---

I am Zirui Ren (任梓瑞), a third-year undergraduate at the Department of Physics, Tsinghua University, with a minor in Computer Science and Technology. I am broadly interested in the science of large models, especially LLM pre-training, mechanistic interpretability, and meta-modeling.

I am currently working with [Prof. Ziming Liu](https://kindxiaoming.github.io/) on meta-modeling for pre-training dynamics and hyperparameter extrapolation. Previously, I have also collaborated with [Prof. Zhiyuan Liu](https://nlp.csai.tsinghua.edu.cn/~lzy/) and researchers at ModelBest (面壁智能) on foundation model architecture, distillation, and long-form generation.

## Education

**Tsinghua University**, Beijing, China — Sep. 2023 | Present  
Major in Physics | Minor in Computer Science and Technology — Cumulative GPA: **3.93 / 4.0**

- **Selected Awards:** Tsinghua Comprehensive Excellence Scholarship (Top 5%, 2024 & 2025)
- **Language Proficiency:** TOEFL 113/120 | CET-6 665/710

## Publications

**Are Your Reasoning Models Reasoning or Guessing? A Mechanistic Analysis of Hierarchical Reasoning Models**  
**Zirui Ren**, Ziming Liu  
[arXiv:2601.10679](https://arxiv.org/abs/2601.10679). *Under review at **NeurIPS 2026** (First Author)*  
We perform a systematic mechanistic study of hierarchical reasoning models (HRMs). By probing latent-state trajectories and structural geometry, we identify critical violations of fixed-point assumptions and a hidden "guessing" shortcut in advanced reasoners. We propose three training-free augmentation techniques that improve HRM accuracy on *Sudoku-Extreme* from **55%** to **97%**, and release an [open-source pipeline](https://github.com/renrua52/hrm-mechanistic-analysis).

**LLM×MapReduce-V2: Entropy-Driven Convolutional Test-Time Scaling for Generating Long-Form Articles from Extremely Long Resources**  
Haoyu Wang, Yujia Fu, Zhu Zhang, Shuo Wang, **Zirui Ren**, Xiaorong Wang, Zhili Li, Chaoqun He, Bo An, Zhiyuan Liu, Maosong Sun  
[arXiv:2504.05732](https://arxiv.org/abs/2504.05732)  
We develop a test-time scaling framework inspired by convolutional architectures, enabling high-fidelity long-form text generation from extremely long inputs. The method is deployed in [SurveyGO](https://surveygo.znyx.com.cn/), ModelBest's production-level academic survey platform.

## Research & Internship Experience

**AI for AI: Meta-Modeling for Pre-training Dynamics & Hyperparameter Extrapolation** — Jan. 2026 | Present  
*Advisor: [Prof. Ziming Liu](https://kindxiaoming.github.io/), College of AI, Tsinghua University*

- **Meta-Modeling beyond Scaling Laws:** Pioneering an "AI for AI" paradigm to break the compute bottleneck of LLM pre-training. Developing a neural meta-model trained to accurately predict training trajectories and performance of target foundation models across various architectures and hyperparameter spaces.
- **Inverse Optimization:** Engineering a differentiable pipeline that leverages the meta-model's predictions to deduce optimal pre-training configurations, aiming to extrapolate to large-scale models beyond traditional scaling laws.

**Mechanistic Analysis of Reasoning Models** — Jul. 2025 | Mar. 2026  
*Collaboration with MIT | Advisor: [Dr. Ziming Liu](https://kindxiaoming.github.io/)*

- **Discovery of Latent Anomalies:** Conducted a systematic mechanistic study on Hierarchical Reasoning Models (HRMs). By probing latent-state trajectories and structural geometry, identified critical violations of fixed-point assumptions, proving that advanced reasoners exhibit a hidden "guessing" shortcut instead of robust rule-based deduction.
- **Intervention & Optimization:** Engineered three training-free representation-steering and inference-guidance techniques derived from mechanistic insights, drastically boosting HRM accuracy on *Sudoku-Extreme* from 55% to **97%**.
- **Infrastructure:** Independently implemented the end-to-end distributed evaluation and probing pipeline (PyTorch), maintaining the open-source [codebase](https://github.com/renrua52/hrm-mechanistic-analysis). (Resulted in a first-author paper.)

**Research Intern (Foundation Model Architecture & Distillation)** — Jun. 2025 | Aug. 2025  
*ModelBest Inc. (面壁智能) | Advisor: [Prof. Zhiyuan Liu](https://nlp.csai.tsinghua.edu.cn/~lzy/), Tsinghua University*

- **Architecture Exploration for SALA-9B:** Served as an early-stage collaborator exploring sub-quadratic model architectures. Conducted fine-grained ablation studies on hybrid lightning-attention modules in 0.6B-scale models.
- **Pre-training & Evaluation:** Executed a 3-stage progressive knowledge distillation pipeline from Qwen3-0.6B via the RADLADS protocol. Tracked training stability and evaluated benchmarks (MMLU, HellaSwag, PIQA, etc.), laying the empirical foundation for ModelBest's million-context **SALA-9B** model.

**Research Intern (Test-Time Scaling for Long-to-long Generation)** — Feb. 2025 | Aug. 2025  
*ModelBest Inc. (面壁智能) | Advisor: [Prof. Zhiyuan Liu](https://nlp.csai.tsinghua.edu.cn/~lzy/), Tsinghua University*

- **Algorithm Design:** Co-developed LLM×MapReduce-V2, a novel test-time scaling framework borrowing CNN convolutional concepts to map ultra-long contexts into structured, multi-stage reasoning graphs for high-fidelity long-form text generation.
- **Implementation:** Successfully scaled the algorithmic prototype into [SurveyGO](https://surveygo.znyx.com.cn/), ModelBest's production-level academic survey platform. Designed the engine handling incremental text refinement conditioned on dynamic streaming references.

## Technical Skills

- **Coding:** Python, PyTorch, C/C++, CUDA/Triton
- **Domain Expertise:** Large Language Model Pre-training / Knowledge Distillation, Linear Attention Mechanisms, Test-time Scaling, Mechanistic Interpretability
