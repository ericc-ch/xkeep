ALTER TABLE `bookmarks` RENAME COLUMN `still_path` TO `still_paths`;
UPDATE `bookmarks`
SET `still_paths` = json_array(`still_paths`)
WHERE `still_paths` IS NOT NULL
  AND json_valid(`still_paths`) = 0;
