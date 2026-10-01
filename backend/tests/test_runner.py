from django.test.runner import DiscoverRunner


class MongoTestRunner(DiscoverRunner):
    """Test runner for MongoEngine: no relational database to create or flush."""

    def setup_databases(self, **kwargs):
        return []

    def teardown_databases(self, old_config, **kwargs):
        pass
