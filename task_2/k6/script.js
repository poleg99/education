import http from 'k6/http';
import {check, sleep} from 'k6';
import { Rate } from 'k6/metrics';

const reqRate = new Rate('http_req_rate');

export const options = {
    stages: [
        {target: 20, duration: '20s'},
        {target: 20, duration: '20s'},
        {target: 0, duration: '20s'},
    ],
    thresholds: {
        'checks': ['rate>0.9'],
        'http_req_duration': ['p(95)<1000'],
        'http_req_rate{deployment:stable Ver1.0}': ['rate>=0'],
        'http_req_rate{deployment:canary Ver2.0}': ['rate>=0'],
    },
};

export default function () {
    const url = `http://${__ENV.URL}`;
    const params = {
        headers: {
            'Host': 'k8s.pavlov.com',
            'Content-Type': 'application/json',
        },
    };

    const res = http.get(`${url}/`, params)
    check(res, {
        'status code is 200': (r) => r.status === 200,
        'node is minikube': (r) => r.json().node === 'minikube',
        'namespace is default': (r) => r.json().namespace === 'default',
        'deployment is stable or canary': (r) => r.json().deployment === 'stable Ver1.0' || r.json().deployment === 'canary Ver2.0',
        'pod is web-*': (r) => r.json().pod.includes('web-'),
    });

    switch (res.json().deployment) {
        case 'stable Ver1.0':
            reqRate.add(true, { deployment: 'stable Ver1.0' })
            reqRate.add(false, { deployment: 'canary Ver2.0' })
            break
        case 'canary Ver2.0':
            reqRate.add(false, { deployment: 'stable Ver1.0' })
            reqRate.add(true, { deployment: 'canary Ver2.0' })
            break
    }

    sleep(1)
}
