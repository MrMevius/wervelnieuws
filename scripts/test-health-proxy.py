"""Exercise the production nginx health route with a disposable backend."""
import json
import pathlib
import subprocess
import tempfile
import time
import uuid


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()


def main():
    prefix = 'windwilly-health-' + uuid.uuid4().hex[:10]
    network, backend, frontend = prefix, prefix + '-backend', prefix + '-frontend'
    config = pathlib.Path(__file__).resolve().parents[1] / 'frontend/nginx.conf'
    with tempfile.TemporaryDirectory() as directory:
        mock = pathlib.Path(directory) / 'backend.conf'
        mock.write_text('''server {
 listen 8000;
 location = /health { default_type application/json; return 200 '{"status":"ok"}'; }
 location /api/ { return 401; }
 location / { return 404; }
}''')
        try:
            docker('network', 'create', '--internal', network)
            docker('run', '-d', '--name', backend, '--network', network,
                   '--network-alias', 'backend', '-v', f'{mock}:/etc/nginx/conf.d/default.conf:ro',
                   'nginx:1.27-alpine')
            docker('run', '-d', '--name', frontend, '--network', network,
                   '-v', f'{config}:/etc/nginx/conf.d/default.conf:ro', 'nginx:1.27-alpine')
            docker('exec', frontend, 'nginx', '-t')
            time.sleep(1)

            def request(path, method='GET'):
                return docker('exec', frontend, 'wget', '-S', '-O', '-',
                              *(['--post-data='] if method == 'POST' else []), 'http://127.0.0.1' + path)

            assert json.loads(request('/api/health')) == {'status': 'ok'}
            for path, method in [('/api/auth/me', 'GET'), ('/api/health', 'POST')]:
                result = subprocess.run(['docker', 'exec', frontend, 'wget', '-S', '-O', '-',
                                         *(['--post-data='] if method == 'POST' else []), 'http://127.0.0.1' + path],
                                        text=True, capture_output=True)
                expected = '401' if path == '/api/auth/me' else '403'
                assert expected in result.stderr, result.stderr
            docker('stop', backend)
            result = subprocess.run(['docker', 'exec', frontend, 'wget', '-S', '-O', '-',
                                     'http://127.0.0.1/api/health'], text=True, capture_output=True)
            assert any(code in result.stderr for code in ('502', '504')), result.stderr
            print('PASS: health JSON, protected API, rejected POST and backend failure')
        finally:
            subprocess.run(['docker', 'rm', '-f', frontend, backend], stdout=subprocess.DEVNULL)
            subprocess.run(['docker', 'network', 'rm', network], stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
