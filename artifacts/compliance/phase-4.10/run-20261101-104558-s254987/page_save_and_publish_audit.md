# Page Save and Publish Audit

## 1. Full Lifecycle State Machine
$$\text{DRAFT} \xrightarrow{\text{Save Draft}} \text{DRAFT (Updated)} \xrightarrow{\text{Publish}} \text{PUBLISHED} \xrightarrow{\text{Unpublish}} \text{DRAFT}$$

## 2. Draft vs Published Isolation
- When an editor modifies sections in the visual canvas and clicks **Save Draft**:
  - `blocks.draft_config` is updated with the new section parameters.
  - `blocks.published_config` is **UNTOUCHED**.
  - Public storefront requests to `getHomepage()` continue reading `published_config`.
- When the editor clicks **Publish**:
  - `blocks.published_config` is populated with the verified draft sections.
  - `status` transitions to `'published'`.
  - An immutable snapshot is appended to `cms_revision`.
  - Public storefront immediately serves the newly published content.
