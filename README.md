# BDSCloudy
Bedrock Dedicated Server API With ExpressJS

## Feature
### Server Command
- Start, Stop, Restart The Server, And clear For Terminal / Power Shell / CMD

### Game Command
- Register, Banned, Unbanned, And All Command

## Installation
Clone Or Extract This Repo Inside Your bedrock_server Folder, Make Sure That index.js And packages.json Is There. Go Ahead And Run:
```bash
  npm install
```

## Configuration
Edit Port, Code, And Endpoint /cmd To Secure Your API
```bash
  const port = 8000;
  const code = 'lts6cloudybridge';
```

## Starting Server
Here We Go...
> node .

## API Reference

HEADERS
| Key       | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `auth`    | `string` | **Required**. Your `code`    |

BODY
| Content-Type | `application/json`      | 
| :----------- | :---------------------- | 
| Data         | `{"no":"","cmd":""}`    |
| Description  | `{"cmd"}` **Required**    |


### Example Using CURL Windows
  **Register Some User**
```bash
  curl -X POST http://localhost:8000/cmd ^-H "Content-Type: application/json" ^-H "auth:lts6cloudybridge" ^d "{\"cmd\":\"reg fankyfankz\"}"
```
If You Want To Specificy Something To The User For Some Reason, You Can Add `{"no":"Write Something Here","cmd":"Your Command"}`

**Ban Some User**
```bash
  curl -X POST http://localhost:8000/cmd ^-H "Content-Type: application/json" ^-H "auth:lts6cloudybridge" ^d "{\"cmd\":\"ban fankyfankz\"}"
```
If You Want To Put Some Reason, You Can Add Coma ',' After Game Tag `"ban fankyfankz, You Have So Much Elytra\"`

**Unban Some User**
```bash
  curl -X POST http://localhost:8000/cmd ^-H "Content-Type: application/json" ^-H "auth:lts6cloudybridge" ^d "{\"cmd\":\"unban fankyfankz\"}"
```
