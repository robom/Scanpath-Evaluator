from datetime import datetime
from os import listdir, path

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON

import src.stringEditAlgs as seAlg
from src.config import config
from src.database import Base, db_session
from src.models.Dataset import Dataset


class DatasetTask(Base):
    """ Common class for grouping a set of scanpaths together based on files stored on the server """

    # Name of corresponding schema table
    __tablename__ = 'tasks'

    # Table columns
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String)
    url = Column(String)
    dataset_id = Column(Integer, ForeignKey('datasets.id', ondelete='CASCADE'), nullable=False)
    date_created = Column(DateTime, default=datetime.now())
    date_updated = Column(DateTime, default=datetime.now(), onupdate=datetime.now)
    scanpath_data_raw = Column(JSON)
    scanpath_data_formatted = Column(JSON)
    aoi_data = Column(JSON)

    def to_json(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'dateCreated': str(self.date_created),
            'dateUpdated': str(self.date_updated)
        }

    def load_data(self):
        # Get parent dataset name
        dataset = db_session.query(Dataset).filter(Dataset.id == self.dataset_id).one()

        # Construct path to images based on config file - e.g. 'static/images/d1/t1/'
        folder_path_visuals = path.join('static', 'images', config['DATASET_FOLDER'], config['DATASET_PREFIX'] +
                                        str(dataset.id), config['TASK_PREFIX'] + str(self.id), '')

        # Fill the data holding objects
        self.load_visuals(folder_path_visuals)

    def exclude_participants(self, excluded):
        """ Exclude all given ids from the participants dict """
        try:
            for identifier in excluded:
                self.scanpath_data_raw.pop(identifier, None)
        except KeyError as e:
            print 'Participant ID to be excluded not found: ' + e.args[0]

    def load_visuals(self, folder_path_visuals):
        # Fetch all image files in specified folder (relying on extension atm)
        try:
            files_list = listdir(folder_path_visuals)
        except:
            return {}

        images_list = {}
        valid_extensions = (".jpg", ".jpeg", ".png", ".gif", ".bmp")

        # Verify if the file is image and add it to the collection
        for filename in files_list:
            if filename.endswith(valid_extensions):
                # images[main] = static/images/datasets/template_sta/main.png
                images_list[path.splitext(filename)[0]] = path.join(folder_path_visuals, filename).replace('\\', '/')

        self.visuals = images_list

    def format_sequences(self, sequences):
        """
        {'01': [[A, 150], [B, 250]], '02': ...} gets transformed into:
        [{'identifier': '01', 'fixations': [[A, 150], [B, 250]]}, {'identifier': '02' ... }]
        """
        formatted_sequences = []
        keys = sequences.keys()
        for it in range(0, len(sequences)):
            act_rec = {
                'identifier': keys[it],
                'fixations': sequences[keys[it]]
            }
            formatted_sequences.append(act_rec)

        return formatted_sequences

    def calc_max_similarity(self, scanpaths):
        """ Function calculates most similar pair for each scanpath in the set """
        for scanpath in scanpaths:
            # Create empty max_similarity object
            max_similar = {
                'identifier':  '',
                'value': -1
            }
            # Iterate through previously calculated similarity values of given scanpath
            for similarity_iter in scanpath['similarity']:
                similarity_val = scanpath['similarity'][similarity_iter]
                if similarity_val > max_similar['value']:
                    max_similar['value'] = similarity_val
                    max_similar['identifier'] = similarity_iter
            # Assign max_similarity object to scanpath (in JSON-style)
            scanpath['maxSimilarity'] = max_similar

        return scanpaths

    def calc_min_similarity(self, scanpaths):
        """ Function calculates least similar pair for each scanpath in the set """
        for scanpath in scanpaths:
            # Create empty max_similarity object
            min_similar = {
                'identifier': '',
                'value': 101
            }
            # Iterate through previously calculated similarity values of given scanpath
            for similarity_iter in scanpath['similarity']:
                similarity_val = scanpath['similarity'][similarity_iter]
                if similarity_val < min_similar['value']:
                    min_similar['value'] = similarity_val
                    min_similar['identifier'] = similarity_iter
            # Assign max_similarity object to scanpath (in JSON-style)
            scanpath['minSimilarity'] = min_similar

        return scanpaths

    def calc_edit_distances(self, scanpaths):
        # Store scanpaths as an array of string-converted original scanpaths
        scanpath_strs = seAlg.convert_to_str_array(scanpaths)

        # Calculate the edit distances
        # The order of records in scanpaths and scanpath_strs must be the same!
        seAlg.calc_mutual_similarity(scanpath_strs)

        for i_first in range(0, len(scanpath_strs)):
            # Save the calculations to the original scanpaths object
            scanpaths[i_first]['similarity'] = scanpath_strs[i_first]['similarity']

        return scanpaths

